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
    BRONCE: { name: 'Bronce', minPoints: 0, maxPoints: 99, minVisits: 0, maxVisits: 9, discount: 0.00, color: '#cd7f32', class: 'tier-bronce', badge: '🟫' },
    PLATA: { name: 'Plata', minPoints: 100, maxPoints: 299, minVisits: 10, maxVisits: 29, discount: 0.05, color: '#c0c0c0', class: 'tier-plata', badge: '⬜' },
    ORO: { name: 'Oro', minPoints: 300, maxPoints: 599, minVisits: 30, maxVisits: 59, discount: 0.10, color: '#ffd700', class: 'tier-oro', badge: '🟨' },
    PLATINO: { name: 'Platino', minPoints: 600, maxPoints: Infinity, minVisits: 60, maxVisits: Infinity, discount: 0.15, color: '#e5e4e2', class: 'tier-platino', badge: '🟦' }
};

export const DEFAULT_REWARDS = [
    { name: 'Tarjeta AM.PASS Oficial', costPoints: 200, description: 'Tarjeta RFID oficial Andamiro para guardar tu perfil y records globales de PIU.', icon: '💳', active: true },
    { name: '1 Hora de Juego Gratis', costPoints: 120, description: 'Cupón para reservar una sesión gratuita de 1 hora en cualquier gabinete disponible.', icon: '🎟️', active: true },
    { name: 'Bebida Hidratante / Energizante', costPoints: 40, description: 'Una bebida fría en mostrador (Powerade, Monster o Agua mineral).', icon: '🥤', active: true },
    { name: 'Ajuste FSR Profesional', costPoints: 80, description: 'Calibración y mantenimiento fino personalizado de sensores FSR para tus pads de ritmo.', icon: '🦶', active: true }
];

class LoyaltyManager {
    getBusinessTiers(business) {
        const defaultTiers = {
            BRONCE: { name: 'Bronce', minPoints: 0, maxPoints: 99, minVisits: 0, maxVisits: 9, discount: 0.00, color: '#cd7f32', class: 'tier-bronce', badge: '🟫' },
            PLATA: { name: 'Plata', minPoints: 100, maxPoints: 299, minVisits: 10, maxVisits: 29, discount: 0.05, color: '#c0c0c0', class: 'tier-plata', badge: '⬜' },
            ORO: { name: 'Oro', minPoints: 300, maxPoints: 599, minVisits: 30, maxVisits: 59, discount: 0.10, color: '#ffd700', class: 'tier-oro', badge: '🟨' },
            PLATINO: { name: 'Platino', minPoints: 600, maxPoints: Infinity, minVisits: 60, maxVisits: Infinity, discount: 0.15, color: '#e5e4e2', class: 'tier-platino', badge: '🟦' }
        };

        const biz = business || tenantManager.getActiveBusiness();
        if (!biz) return defaultTiers;

        const customTiers = biz.loyaltyTiers;
        if (customTiers) {
            const tiers = JSON.parse(JSON.stringify(defaultTiers));
            
            // Bronce
            if (customTiers.BRONCE) {
                tiers.BRONCE.minPoints = Number(customTiers.BRONCE.minPoints) || 0;
                tiers.BRONCE.minVisits = Number(customTiers.BRONCE.minVisits) || 0;
                tiers.BRONCE.discount = Number(customTiers.BRONCE.discount) || 0;
            }
            // Plata
            if (customTiers.PLATA) {
                tiers.PLATA.minPoints = Number(customTiers.PLATA.minPoints) || 100;
                tiers.PLATA.minVisits = Number(customTiers.PLATA.minVisits) || 10;
                tiers.PLATA.discount = Number(customTiers.PLATA.discount) || 0.05;
            }
            // Oro
            if (customTiers.ORO) {
                tiers.ORO.minPoints = Number(customTiers.ORO.minPoints) || 300;
                tiers.ORO.minVisits = Number(customTiers.ORO.minVisits) || 30;
                tiers.ORO.discount = Number(customTiers.ORO.discount) || 0.10;
            }
            // Platino
            if (customTiers.PLATINO) {
                tiers.PLATINO.minPoints = Number(customTiers.PLATINO.minPoints) || 600;
                tiers.PLATINO.minVisits = Number(customTiers.PLATINO.minVisits) || 60;
                tiers.PLATINO.discount = Number(customTiers.PLATINO.discount) || 0.15;
            }

            // Recalcular maxPoints y maxVisits dinámicamente según el siguiente nivel
            tiers.BRONCE.maxPoints = tiers.PLATA.minPoints - 1;
            tiers.BRONCE.maxVisits = tiers.PLATA.minVisits - 1;

            tiers.PLATA.maxPoints = tiers.ORO.minPoints - 1;
            tiers.PLATA.maxVisits = tiers.ORO.minVisits - 1;

            tiers.ORO.maxPoints = tiers.PLATINO.minPoints - 1;
            tiers.ORO.maxVisits = tiers.PLATINO.minVisits - 1;

            return tiers;
        }

        return defaultTiers;
    }

    calculateTier(value, mode = null, business = null) {
        const val = Number(value) || 0;
        const biz = business || tenantManager.getActiveBusiness();
        const activeMode = mode || biz?.loyaltyMode || 'POINTS';
        const tiers = this.getBusinessTiers(biz);
        
        if (activeMode === 'VISITS') {
            if (val >= tiers.PLATINO.minVisits) return tiers.PLATINO;
            if (val >= tiers.ORO.minVisits) return tiers.ORO;
            if (val >= tiers.PLATA.minVisits) return tiers.PLATA;
            return tiers.BRONCE;
        } else {
            if (val >= tiers.PLATINO.minPoints) return tiers.PLATINO;
            if (val >= tiers.ORO.minPoints) return tiers.ORO;
            if (val >= tiers.PLATA.minPoints) return tiers.PLATA;
            return tiers.BRONCE;
        }
    }

    getDiscountForTier(tierName, business = null) {
        const name = (tierName || '').toUpperCase();
        const biz = business || tenantManager.getActiveBusiness();
        const tiers = this.getBusinessTiers(biz);
        return tiers[name]?.discount || tiers.BRONCE.discount;
    }

    getPointsNeededForNextTier(value, mode = null, business = null) {
        const val = Number(value) || 0;
        const biz = business || tenantManager.getActiveBusiness();
        const activeMode = mode || biz?.loyaltyMode || 'POINTS';
        const tiers = this.getBusinessTiers(biz);
        const currentTier = this.calculateTier(val, activeMode, biz);
        
        let nextTier = null;
        if (currentTier.name === 'Bronce') nextTier = tiers.PLATA;
        else if (currentTier.name === 'Plata') nextTier = tiers.ORO;
        else if (currentTier.name === 'Oro') nextTier = tiers.PLATINO;
        
        if (!nextTier) {
            return { pointsNeeded: 0, nextTierName: null, progressPercent: 100 };
        }
        
        const minVal = activeMode === 'VISITS' ? nextTier.minVisits : nextTier.minPoints;
        const currentMinVal = activeMode === 'VISITS' ? currentTier.minVisits : currentTier.minPoints;
        
        const pointsNeeded = minVal - val;
        const range = minVal - currentMinVal;
        const progress = Math.min(100, Math.max(0, ((val - currentMinVal) / (range || 1)) * 100));
        
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
                    
                    const playerData = playerDoc.data();
                    const loyaltyMap = playerData.loyalty || {};
                    const bizLoyalty = loyaltyMap[businessId] || { points: 0, visits: 0, tier: 'Bronce' };

                    const bizRef = doc(db, COLLECTIONS.BUSINESSES, businessId);
                    const bizSnap = await transaction.get(bizRef);
                    const bizMode = (bizSnap.exists() && bizSnap.data().loyaltyMode) || 'POINTS';

                    const isVisits = bizMode === 'VISITS';
                    const balance = isVisits ? (bizLoyalty.visits || 0) : (bizLoyalty.points || 0);

                    if (balance < pointsCost) {
                        throw new Error(`${isVisits ? 'Visitas' : 'Puntos'} insuficientes. Tienes ${balance} de ${pointsCost} requeridos.`);
                    }

                    const nextPoints = Math.max(0, (bizLoyalty.points || 0) - pointsCost);
                    const nextVisits = isVisits ? Math.max(0, (bizLoyalty.visits || 0) - pointsCost) : (bizLoyalty.visits || 0);
                    
                    const valueForTier = isVisits ? nextVisits : nextPoints;
                    const nextTier = this.calculateTier(valueForTier, bizMode).name;

                    loyaltyMap[businessId] = {
                        points: nextPoints,
                        visits: nextVisits,
                        tier: nextTier
                    };

                    transaction.update(playerRef, {
                        loyalty: loyaltyMap
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

            const loyaltyMap = players[pIdx].loyalty || {};
            const bizLoyalty = loyaltyMap[businessId] || { points: 0, visits: 0, tier: 'Bronce' };

            const businesses = JSON.parse(localStorage.getItem('piu_businesses') || '[]');
            const biz = businesses.find(b => b.id === businessId);
            const bizMode = (biz && biz.loyaltyMode) || 'POINTS';

            const isVisits = bizMode === 'VISITS';
            const balance = isVisits ? (bizLoyalty.visits || 0) : (bizLoyalty.points || 0);

            if (balance < pointsCost) {
                throw new Error(`${isVisits ? 'Visitas' : 'Puntos'} insuficientes. Tienes ${balance} de ${pointsCost} requeridos.`);
            }

            const nextPoints = Math.max(0, (bizLoyalty.points || 0) - pointsCost);
            const nextVisits = isVisits ? Math.max(0, (bizLoyalty.visits || 0) - pointsCost) : (bizLoyalty.visits || 0);

            const valueForTier = isVisits ? nextVisits : nextPoints;
            const nextTier = this.calculateTier(valueForTier, bizMode).name;

            loyaltyMap[businessId] = {
                points: nextPoints,
                visits: nextVisits,
                tier: nextTier
            };

            players[pIdx].loyalty = loyaltyMap;
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

    async cancelRedemption(redemptionId, businessId, refundPoints = false) {
        if (isFirebaseAvailable && db) {
            try {
                const ref = doc(db, COLLECTIONS.REDEMPTIONS, redemptionId);
                const redSnap = await getDoc(ref);
                if (!redSnap.exists()) throw new Error("Canje no encontrado.");
                const redData = redSnap.data();

                if (refundPoints && redData.clientId) {
                    // Devolver los puntos/visitas en una transacción
                    const playerRef = doc(db, COLLECTIONS.PLAYERS, redData.clientId);
                    await runTransaction(db, async (transaction) => {
                        const playerDoc = await transaction.get(playerRef);
                        if (playerDoc.exists()) {
                            const playerData = playerDoc.data();
                            const loyaltyMap = playerData.loyalty || {};
                            const bizLoyalty = loyaltyMap[businessId] || { points: 0, visits: 0, tier: 'Bronce' };

                            const bizRef = doc(db, COLLECTIONS.BUSINESSES, businessId);
                            const bizSnap = await transaction.get(bizRef);
                            const bizMode = (bizSnap.exists() && bizSnap.data().loyaltyMode) || 'POINTS';

                            const pointsRefund = Number(redData.pointsCost) || 0;
                            const isVisits = bizMode === 'VISITS';

                            const nextPoints = (bizLoyalty.points || 0) + pointsRefund;
                            const nextVisits = isVisits ? (bizLoyalty.visits || 0) + pointsRefund : (bizLoyalty.visits || 0);

                            const valueForTier = isVisits ? nextVisits : nextPoints;
                            const nextTier = this.calculateTier(valueForTier, bizMode).name;

                            loyaltyMap[businessId] = {
                                points: nextPoints,
                                visits: nextVisits,
                                tier: nextTier
                            };

                            transaction.update(playerRef, { loyalty: loyaltyMap });
                        }
                    });
                }

                await updateDoc(ref, {
                    status: 'CANCELLED',
                    cancelledAt: new Date().toISOString()
                });
            } catch (e) {
                console.error("Error cancelando canje en Firebase:", e);
                throw e;
            }
        } else {
            // Local fallback
            const players = JSON.parse(localStorage.getItem('piu_registered_players_cache') || '[]');
            let foundClient = null;
            let foundRedData = null;

            for (const p of players) {
                const localKey = `piu_redemptions_${p.id}`;
                const list = JSON.parse(localStorage.getItem(localKey) || '[]');
                const idx = list.findIndex(r => r.id === redemptionId);
                if (idx !== -1) {
                    foundRedData = list[idx];
                    foundClient = p;
                    list[idx].status = 'CANCELLED';
                    list[idx].cancelledAt = new Date().toISOString();
                    localStorage.setItem(localKey, JSON.stringify(list));
                    break;
                }
            }

            if (!foundRedData) throw new Error("Canje no encontrado localmente.");

            if (refundPoints && foundClient) {
                const loyaltyMap = foundClient.loyalty || {};
                const bizLoyalty = loyaltyMap[businessId] || { points: 0, visits: 0, tier: 'Bronce' };

                const businesses = JSON.parse(localStorage.getItem('piu_businesses') || '[]');
                const biz = businesses.find(b => b.id === businessId);
                const bizMode = (biz && biz.loyaltyMode) || 'POINTS';

                const pointsRefund = Number(foundRedData.pointsCost) || 0;
                const isVisits = bizMode === 'VISITS';

                const nextPoints = (bizLoyalty.points || 0) + pointsRefund;
                const nextVisits = isVisits ? (bizLoyalty.visits || 0) + pointsRefund : (bizLoyalty.visits || 0);

                const valueForTier = isVisits ? nextVisits : nextPoints;
                const nextTier = this.calculateTier(valueForTier, bizMode).name;

                loyaltyMap[businessId] = {
                    points: nextPoints,
                    visits: nextVisits,
                    tier: nextTier
                };

                foundClient.loyalty = loyaltyMap;
                localStorage.setItem('piu_registered_players_cache', JSON.stringify(players));
            }
        }
        return true;
    }

    // ==========================================
    // AJUSTE MANUAL DE PUNTOS POR ADMIN
    // ==========================================
    async adjustPlayerPoints(businessId, playerId, pointsChange, visitsChange, reason = '') {
        // Soporte de compatibilidad si se llama con la firma anterior (playerId, points, visits, reason)
        let actualBusinessId = businessId;
        let actualPlayerId = playerId;
        let actualPointsChange = pointsChange;
        let actualVisitsChange = visitsChange;
        let actualReason = reason;

        if (typeof businessId === 'string' && businessId.startsWith('p_')) {
            // Se llamó con la firma anterior: adjustPlayerPoints(playerId, pointsChange, visitsChange, reason)
            actualBusinessId = tenantManager.getActiveBusiness()?.id || '';
            actualPlayerId = businessId;
            actualPointsChange = playerId;
            actualVisitsChange = pointsChange;
            actualReason = visitsChange || '';
        }

        if (!actualBusinessId) throw new Error("ID de local no provisto para el ajuste.");
        if (!actualPlayerId) throw new Error("ID de jugador no provisto para el ajuste.");

        const ptsChange = Number(actualPointsChange) || 0;
        const vtsChange = Number(actualVisitsChange) || 0;

        if (isFirebaseAvailable && db) {
            try {
                const playerRef = doc(db, COLLECTIONS.PLAYERS, actualPlayerId);
                const bizRef = doc(db, COLLECTIONS.BUSINESSES, actualBusinessId);

                await runTransaction(db, async (transaction) => {
                    const playerDoc = await transaction.get(playerRef);
                    if (!playerDoc.exists()) throw new Error("Jugador no encontrado.");
                    
                    const bizSnap = await transaction.get(bizRef);
                    const bizMode = (bizSnap.exists() && bizSnap.data().loyaltyMode) || 'POINTS';

                    const playerData = playerDoc.data();
                    const loyaltyMap = playerData.loyalty || {};
                    const bizLoyalty = loyaltyMap[actualBusinessId] || { points: 0, visits: 0, tier: 'Bronce' };

                    const curPts = bizLoyalty.points || 0;
                    const curVts = bizLoyalty.visits || 0;
                    
                    const newPts = Math.max(0, curPts + ptsChange);
                    const newVts = Math.max(0, curVts + vtsChange);
                    const valueForTier = bizMode === 'VISITS' ? newVts : newPts;
                    const newTier = this.calculateTier(valueForTier, bizMode).name;

                    loyaltyMap[actualBusinessId] = {
                        points: newPts,
                        visits: newVts,
                        tier: newTier
                    };

                    transaction.update(playerRef, {
                        loyalty: loyaltyMap
                    });
                });
            } catch (err) {
                console.error("Error ajustando puntos por local en Firebase:", err);
                throw err;
            }
        } else {
            const players = JSON.parse(localStorage.getItem('piu_registered_players_cache') || '[]');
            const idx = players.findIndex(p => p.id === actualPlayerId);
            if (idx === -1) throw new Error("Jugador no encontrado localmente.");

            const loyaltyMap = players[idx].loyalty || {};
            const bizLoyalty = loyaltyMap[actualBusinessId] || { points: 0, visits: 0, tier: 'Bronce' };

            const curPts = bizLoyalty.points || 0;
            const curVts = bizLoyalty.visits || 0;

            const newPts = Math.max(0, curPts + ptsChange);
            const newVts = Math.max(0, curVts + vtsChange);

            const businesses = JSON.parse(localStorage.getItem('piu_businesses') || '[]');
            const biz = businesses.find(b => b.id === actualBusinessId);
            const bizMode = (biz && biz.loyaltyMode) || 'POINTS';

            const valueForTier = bizMode === 'VISITS' ? newVts : newPts;
            const newTier = this.calculateTier(valueForTier, bizMode).name;

            loyaltyMap[actualBusinessId] = {
                points: newPts,
                visits: newVts,
                tier: newTier
            };

            players[idx].loyalty = loyaltyMap;
            localStorage.setItem('piu_registered_players_cache', JSON.stringify(players));
        }

        return true;
    }
}

export const loyaltyManager = new LoyaltyManager();
