// js/core/loyaltyManager.js
// Gestor de Programa de Lealtad (Tiers, Puntos, Recompensas y Canjes) con Firestore como fuente de verdad
import { 
    db, 
    isFirebaseAvailable, 
    COLLECTIONS, 
    collection, 
    getDocs, 
    setDoc, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    getDoc,
    runTransaction
} from '../firebaseConfig.js';
import { tenantManager } from './tenantManager.js';
import { store } from './store.js';

export const TIERS = {
    BRONCE: { name: 'Bronce', minPoints: 0, maxPoints: 99, discount: 0.00, color: '#cd7f32', class: 'tier-bronce', badge: '🟫' },
    PLATA: { name: 'Plata', minPoints: 100, maxPoints: 299, discount: 0.05, color: '#c0c0c0', class: 'tier-plata', badge: '⬜' },
    ORO: { name: 'Oro', minPoints: 300, maxPoints: 599, discount: 0.10, color: '#ffd700', class: 'tier-oro', badge: '🟨' },
    PLATINO: { name: 'Platino', minPoints: 600, maxPoints: Infinity, discount: 0.15, color: '#e5e4e2', class: 'tier-platino', badge: '🟦' }
};

export const DEFAULT_REWARDS = [
    { name: 'Tarjeta AM.PASS Oficial', costPoints: 200, description: 'Tarjeta RFID oficial Andamiro para guardar tu perfil y records globales de PIU.', icon: '💳', active: true },
    { name: '1 Hora de Juego Gratis', costPoints: 120, description: 'Cupón para reservar una sesión gratuita de 1 hora en cualquier gabinete disponible.', icon: '🎟️', active: true },
    { name: 'Bebida Hidratante / Energizante', costPoints: 40, description: 'Una bebida fría en mostrador (Powerade, Monster o Agua mineral).', icon: '🥤', active: true },
    { name: 'Ajuste FSR Profesional', costPoints: 80, description: 'Calibración y mantenimiento fino personalizado de sensores FSR para tus pads de ritmo.', icon: '🦶', active: true }
];

class LoyaltyManager {
    calculateTier(points) {
        const pts = Number(points) || 0;
        if (pts >= TIERS.PLATINO.minPoints) return TIERS.PLATINO;
        if (pts >= TIERS.ORO.minPoints) return TIERS.ORO;
        if (pts >= TIERS.PLATA.minPoints) return TIERS.PLATA;
        return TIERS.BRONCE;
    }

    getDiscountForTier(tierName) {
        const name = (tierName || '').toUpperCase();
        return TIERS[name]?.discount || TIERS.BRONCE.discount;
    }

    getPointsNeededForNextTier(points) {
        const pts = Number(points) || 0;
        const currentTier = this.calculateTier(pts);
        
        let nextTier = null;
        if (currentTier.name === 'Bronce') nextTier = TIERS.PLATA;
        else if (currentTier.name === 'Plata') nextTier = TIERS.ORO;
        else if (currentTier.name === 'Oro') nextTier = TIERS.PLATINO;
        
        if (!nextTier) {
            return { pointsNeeded: 0, nextTierName: null, progressPercent: 100 };
        }
        
        const pointsNeeded = nextTier.minPoints - pts;
        const range = nextTier.minPoints - currentTier.minPoints;
        const progress = Math.min(100, Math.max(0, ((pts - currentTier.minPoints) / range) * 100));
        
        return { pointsNeeded, nextTierName: nextTier.name, progressPercent: Math.round(progress) };
    }

    // ==========================================
    // GESTIÓN DEL CATÁLOGO DE PREMIOS (POR LOCAL)
    // ==========================================
    async getRewardsCatalog(businessId) {
        if (!businessId) return [];
        let rewards = [];
        
        if (isFirebaseAvailable && db) {
            try {
                const q = query(collection(db, COLLECTIONS.LOYALTY_REWARDS), where("businessId", "==", businessId));
                const snap = await getDocs(q);
                snap.forEach(d => rewards.push({ id: d.id, ...d.data() }));
            } catch (e) {
                console.warn("Error cargando premios de Firebase:", e);
            }
        }
        
        if (rewards.length === 0) {
            const local = localStorage.getItem(`piu_rewards_${businessId}`);
            if (local) {
                try { rewards = JSON.parse(local); } catch (e) { rewards = []; }
            }
        }
        
        if (rewards.length === 0) {
            // Inicializar catálogo predeterminado
            rewards = DEFAULT_REWARDS.map((r, index) => ({
                id: `rew_${Date.now()}_${index}`,
                businessId: businessId,
                ...r,
                createdAt: new Date().toISOString()
            }));
            localStorage.setItem(`piu_rewards_${businessId}`, JSON.stringify(rewards));
            
            if (isFirebaseAvailable && db) {
                for (const rew of rewards) {
                    try { await setDoc(doc(db, COLLECTIONS.LOYALTY_REWARDS, rew.id), rew); } catch (e) {}
                }
            }
        }
        
        return rewards;
    }

    async addReward(businessId, rewardData) {
        const newReward = {
            id: 'rew_' + Date.now(),
            businessId: businessId,
            name: rewardData.name.trim(),
            costPoints: Number(rewardData.costPoints) || 50,
            description: rewardData.description.trim(),
            icon: rewardData.icon || '🎁',
            active: rewardData.active !== false,
            createdAt: new Date().toISOString()
        };

        const catalog = await this.getRewardsCatalog(businessId);
        catalog.push(newReward);
        localStorage.setItem(`piu_rewards_${businessId}`, JSON.stringify(catalog));

        if (isFirebaseAvailable && db) {
            try {
                await setDoc(doc(db, COLLECTIONS.LOYALTY_REWARDS, newReward.id), newReward);
            } catch (e) {
                console.error("Error guardando premio en Firebase:", e);
            }
        }
        return newReward;
    }

    async updateReward(businessId, rewardId, updatedFields) {
        const catalog = await this.getRewardsCatalog(businessId);
        const idx = catalog.findIndex(r => r.id === rewardId);
        if (idx === -1) return null;

        catalog[idx] = { ...catalog[idx], ...updatedFields };
        localStorage.setItem(`piu_rewards_${businessId}`, JSON.stringify(catalog));

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.LOYALTY_REWARDS, rewardId), updatedFields);
            } catch (e) {
                console.error("Error actualizando premio en Firebase:", e);
            }
        }
        return catalog[idx];
    }

    async deleteReward(businessId, rewardId) {
        let catalog = await this.getRewardsCatalog(businessId);
        catalog = catalog.filter(r => r.id !== rewardId);
        localStorage.setItem(`piu_rewards_${businessId}`, JSON.stringify(catalog));

        if (isFirebaseAvailable && db) {
            try {
                await deleteDoc(doc(db, COLLECTIONS.LOYALTY_REWARDS, rewardId));
            } catch (e) {
                console.error("Error eliminando premio en Firebase:", e);
            }
        }
        return true;
    }

    // ==========================================
    // CANJES DE PREMIOS (REDEMPTIONS)
    // ==========================================
    async getRedemptions(userId) {
        if (!userId) return [];
        let redemptions = [];

        if (isFirebaseAvailable && db) {
            try {
                const q = query(collection(db, COLLECTIONS.REDEMPTIONS), where("clientId", "==", userId));
                const snap = await getDocs(q);
                snap.forEach(d => redemptions.push({ id: d.id, ...d.data() }));
            } catch (e) {
                console.warn("Error cargando canjes de Firebase:", e);
            }
        }

        const localKey = `piu_redemptions_${userId}`;
        if (redemptions.length === 0) {
            const local = localStorage.getItem(localKey);
            if (local) {
                try { redemptions = JSON.parse(local); } catch (e) { redemptions = []; }
            }
        } else {
            localStorage.setItem(localKey, JSON.stringify(redemptions));
        }

        return redemptions.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    async getBusinessRedemptions(businessId) {
        if (!businessId) return [];
        let redemptions = [];

        if (isFirebaseAvailable && db) {
            try {
                const q = query(
                    collection(db, COLLECTIONS.REDEMPTIONS), 
                    where("businessId", "==", businessId)
                );
                const snap = await getDocs(q);
                snap.forEach(d => redemptions.push({ id: d.id, ...d.data() }));
            } catch (e) {
                console.warn("Error cargando canjes globales de Firebase:", e);
            }
        } else {
            // Unir todos los canjes locales cargados
            const players = JSON.parse(localStorage.getItem('piu_registered_players_cache') || '[]');
            for (const p of players) {
                const local = localStorage.getItem(`piu_redemptions_${p.id}`);
                if (local) {
                    try {
                        const parsed = JSON.parse(local);
                        redemptions.push(...parsed.filter(r => r.businessId === businessId));
                    } catch(e) {}
                }
            }
        }
        return redemptions.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    async redeemReward(userId, username, name, businessId, reward) {
        const pointsCost = Number(reward.costPoints);
        const code = `LTY-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        
        const newRedemption = {
            id: 'red_' + Date.now(),
            businessId,
            clientId: userId,
            clientUsername: username,
            clientName: name,
            rewardId: reward.id,
            rewardName: reward.name,
            rewardIcon: reward.icon,
            pointsCost,
            code,
            status: 'PENDING', // PENDING, REDEEMED (Entregado)
            createdAt: new Date().toISOString()
        };

        if (isFirebaseAvailable && db) {
            try {
                const playerRef = doc(db, COLLECTIONS.PLAYERS, userId);
                await runTransaction(db, async (transaction) => {
                    const playerDoc = await transaction.get(playerRef);
                    if (!playerDoc.exists()) {
                        throw new Error("El jugador no existe.");
                    }
                    
                    const currentPoints = playerDoc.data().loyaltyPoints || 0;
                    if (currentPoints < pointsCost) {
                        throw new Error(`Puntos insuficientes. Tienes ${currentPoints} de ${pointsCost} requeridos.`);
                    }

                    const nextPoints = currentPoints - pointsCost;
                    const nextTier = this.calculateTier(nextPoints).name;

                    transaction.update(playerRef, {
                        loyaltyPoints: nextPoints,
                        loyaltyTier: nextTier
                    });

                    const redemptionRef = doc(db, COLLECTIONS.REDEMPTIONS, newRedemption.id);
                    transaction.set(redemptionRef, newRedemption);
                });
            } catch (err) {
                console.error("Transacción de canje fallida:", err);
                throw err;
            }
        } else {
            // Local fallback
            const players = JSON.parse(localStorage.getItem('piu_registered_players_cache') || '[]');
            const pIdx = players.findIndex(p => p.id === userId);
            if (pIdx === -1) throw new Error("Jugador no encontrado localmente.");

            const currentPoints = players[pIdx].loyaltyPoints || 0;
            if (currentPoints < pointsCost) {
                throw new Error(`Puntos insuficientes. Tienes ${currentPoints} de ${pointsCost} requeridos.`);
            }

            players[pIdx].loyaltyPoints = currentPoints - pointsCost;
            players[pIdx].loyaltyTier = this.calculateTier(players[pIdx].loyaltyPoints).name;
            localStorage.setItem('piu_registered_players_cache', JSON.stringify(players));

            const localKey = `piu_redemptions_${userId}`;
            const userRedemptions = JSON.parse(localStorage.getItem(localKey) || '[]');
            userRedemptions.push(newRedemption);
            localStorage.setItem(localKey, JSON.stringify(userRedemptions));
        }

        return newRedemption;
    }

    async claimRedemption(redemptionId, businessId) {
        if (isFirebaseAvailable && db) {
            try {
                const ref = doc(db, COLLECTIONS.REDEMPTIONS, redemptionId);
                await updateDoc(ref, {
                    status: 'REDEEMED',
                    claimedAt: new Date().toISOString()
                });
            } catch (e) {
                console.error("Error reclamando premio en Firebase:", e);
                throw e;
            }
        } else {
            // Buscar localmente
            const players = JSON.parse(localStorage.getItem('piu_registered_players_cache') || '[]');
            let claimed = false;
            for (const p of players) {
                const localKey = `piu_redemptions_${p.id}`;
                const list = JSON.parse(localStorage.getItem(localKey) || '[]');
                const idx = list.findIndex(r => r.id === redemptionId);
                if (idx !== -1) {
                    list[idx].status = 'REDEEMED';
                    list[idx].claimedAt = new Date().toISOString();
                    localStorage.setItem(localKey, JSON.stringify(list));
                    claimed = true;
                    break;
                }
            }
            if (!claimed) throw new Error("Canje no encontrado localmente.");
        }
        return true;
    }

    // ==========================================
    // AJUSTE MANUAL DE PUNTOS POR ADMIN
    // ==========================================
    async adjustPlayerPoints(playerId, pointsChange, visitsChange, reason = '') {
        const ptsChange = Number(pointsChange) || 0;
        const vtsChange = Number(visitsChange) || 0;

        if (isFirebaseAvailable && db) {
            try {
                const playerRef = doc(db, COLLECTIONS.PLAYERS, playerId);
                await runTransaction(db, async (transaction) => {
                    const playerDoc = await transaction.get(playerRef);
                    if (!playerDoc.exists()) throw new Error("Jugador no encontrado.");
                    
                    const curPts = playerDoc.data().loyaltyPoints || 0;
                    const curVts = playerDoc.data().loyaltyVisits || 0;
                    
                    const newPts = Math.max(0, curPts + ptsChange);
                    const newVts = Math.max(0, curVts + vtsChange);
                    const newTier = this.calculateTier(newPts).name;

                    transaction.update(playerRef, {
                        loyaltyPoints: newPts,
                        loyaltyVisits: newVts,
                        loyaltyTier: newTier
                    });
                });
            } catch (err) {
                console.error("Error ajustando puntos en Firebase:", err);
                throw err;
            }
        } else {
            const players = JSON.parse(localStorage.getItem('piu_registered_players_cache') || '[]');
            const idx = players.findIndex(p => p.id === playerId);
            if (idx === -1) throw new Error("Jugador no encontrado localmente.");

            const curPts = players[idx].loyaltyPoints || 0;
            const curVts = players[idx].loyaltyVisits || 0;

            players[idx].loyaltyPoints = Math.max(0, curPts + ptsChange);
            players[idx].loyaltyVisits = Math.max(0, curVts + vtsChange);
            players[idx].loyaltyTier = this.calculateTier(players[idx].loyaltyPoints).name;
            localStorage.setItem('piu_registered_players_cache', JSON.stringify(players));
        }

        return true;
    }
}

export const loyaltyManager = new LoyaltyManager();
