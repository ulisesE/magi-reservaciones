// js/core/store.js
// Almacén reactivo de datos (Máquinas, Reservaciones, Configuración) con sincronización Firebase y fallback LocalStorage
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
    onSnapshot, 
    query, 
    where 
} from '../firebaseConfig.js';
import { tenantManager } from './tenantManager.js';
import { authManager } from './authManager.js';
import { formatDateKey, isOverlapping } from './timeUtils.js';

// Modelos y datos de prueba predeterminados de Pump It Up
const DEFAULT_MACHINES_BY_BIZ = {
    'biz_piu_centro': [
        {
            id: 'mach_lx_phoenix_01',
            businessId: 'biz_piu_centro',
            name: 'PIU Phoenix LX #1 (Pro Stage)',
            model: 'LX 55" LED Cabinet',
            version: 'Phoenix 2024 (v1.08)',
            status: 'AVAILABLE',
            padsCondition: 'Sensores FSR calibrados a 4.5/5. Bares reforzados.',
            hourlyRate: 120,
            imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
            features: ['55" 120Hz Display', 'Sound Subwoofer 2.1', 'AM.PASS Card Reader', 'Barra Pro'],
            createdAt: new Date().toISOString()
        },
        {
            id: 'mach_tx_xx_02',
            businessId: 'biz_piu_centro',
            name: 'PIU XX 20th Anniv. TX #2',
            model: 'TX 50" HD Cabinet',
            version: 'XX 20th Anniversary (v2.08)',
            status: 'AVAILABLE',
            padsCondition: 'Sensibilidad media-alta, pads originales Andamiro.',
            hourlyRate: 100,
            imageUrl: 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?auto=format&fit=crop&w=600&q=80',
            features: ['50" HD Screen', 'Iluminación Neón LED', 'AM.PASS Compatible'],
            createdAt: new Date().toISOString()
        },
        {
            id: 'mach_fx_prime_03',
            businessId: 'biz_piu_centro',
            name: 'PIU Prime 2 FX #3',
            model: 'FX 42" Cabinet',
            version: 'Prime 2 (v2.05)',
            status: 'AVAILABLE',
            padsCondition: 'Ideal para principiantes y freestyle.',
            hourlyRate: 80,
            imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80',
            features: ['42" Screen', 'Clásico Sound System', 'Pads Suaves'],
            createdAt: new Date().toISOString()
        }
    ],
    'biz_arcade_galaxy': [
        {
            id: 'mach_gal_lx_01',
            businessId: 'biz_arcade_galaxy',
            name: 'PIU Phoenix Premium LX',
            model: 'LX 55" White Special',
            version: 'Phoenix 2024',
            status: 'AVAILABLE',
            padsCondition: 'Pads FSR de competición ultra-sensibles.',
            hourlyRate: 130,
            imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
            features: ['55" 4K', 'Camara Stream integrada', 'AM.PASS'],
            createdAt: new Date().toISOString()
        },
        {
            id: 'mach_gal_xx_02',
            businessId: 'biz_arcade_galaxy',
            name: 'PIU XX TX Galaxy',
            model: 'TX 50" Black Edition',
            version: 'XX 20th Anniversary',
            status: 'MAINTENANCE',
            padsCondition: 'Calibración de sensor flecha azul superior izquierda en progreso.',
            hourlyRate: 95,
            imageUrl: 'https://images.unsplash.com/photo-1534423861386-85a16f5d13fd?auto=format&fit=crop&w=600&q=80',
            features: ['50" HD', 'Subwoofer High-Power'],
            createdAt: new Date().toISOString()
        }
    ]
};

function createDemoReservations(businessId) {
    const today = new Date();
    const todayKey = formatDateKey(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = formatDateKey(tomorrow);
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    const dayAfterKey = formatDateKey(dayAfter);

    if (businessId === 'biz_piu_centro') {
        return [
            {
                id: 'res_demo_01',
                businessId: 'biz_piu_centro',
                machineId: 'mach_lx_phoenix_01',
                clientName: 'Alex "StepMaster"',
                clientPhone: '5511223344',
                date: todayKey,
                startTime: '14:00',
                endTime: '16:00',
                durationMinutes: 120,
                status: 'CONFIRMED',
                totalCost: 240,
                notes: 'Práctica para torneo nacional Single D24.',
                adminNotes: 'Aprobado por Encargado Centro.',
                createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
            },
            {
                id: 'res_demo_02',
                businessId: 'biz_piu_centro',
                machineId: 'mach_tx_xx_02',
                clientName: 'Valeria G.',
                clientPhone: '5599887766',
                date: todayKey,
                startTime: '17:00',
                endTime: '18:00',
                durationMinutes: 60,
                status: 'PENDING',
                totalCost: 100,
                notes: 'Solicitud web: Modo Co-Op con amigos.',
                createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
            },
            {
                id: 'res_demo_03',
                businessId: 'biz_piu_centro',
                machineId: 'mach_lx_phoenix_01',
                clientName: 'Rodrigo PIU',
                clientPhone: '5544332211',
                date: todayKey,
                startTime: '19:00',
                endTime: '20:00',
                durationMinutes: 60,
                status: 'CONFIRMED',
                totalCost: 120,
                notes: 'Sesión de Stream / AM.PASS.',
                createdAt: new Date(Date.now() - 3600000 * 10).toISOString()
            },
            {
                id: 'res_demo_04',
                businessId: 'biz_piu_centro',
                machineId: 'mach_fx_prime_03',
                clientName: 'Daniel & Sofía',
                clientPhone: '5577665544',
                date: tomorrowKey,
                startTime: '15:00',
                endTime: '17:00',
                durationMinutes: 120,
                status: 'CONFIRMED',
                totalCost: 160,
                notes: 'Clase de iniciación básica.',
                createdAt: new Date().toISOString()
            },
            {
                id: 'res_demo_05',
                businessId: 'biz_piu_centro',
                machineId: 'mach_lx_phoenix_01',
                clientName: 'K-Pump Crew',
                clientPhone: '5533221100',
                date: dayAfterKey,
                startTime: '18:00',
                endTime: '21:00',
                durationMinutes: 180,
                status: 'PENDING',
                totalCost: 360,
                notes: 'Reserva para equipo de 4 personas.',
                createdAt: new Date().toISOString()
            }
        ];
    }

    return [
        {
            id: 'res_gal_01',
            businessId: 'biz_arcade_galaxy',
            machineId: 'mach_gal_lx_01',
            clientName: 'Carlos Speed',
            clientPhone: '8111223344',
            date: todayKey,
            startTime: '16:00',
            endTime: '18:00',
            durationMinutes: 120,
            status: 'CONFIRMED',
            totalCost: 260,
            notes: 'Entrenamiento Doubles.',
            createdAt: new Date().toISOString()
        }
    ];
}

class Store {
    constructor() {
        this.machines = [];
        this.reservations = [];
        this.currentBusiness = null;
        this.userRole = 'CLIENT'; // 'CLIENT', 'MANAGER', 'SUPERADMIN'
        this.selectedDate = formatDateKey(new Date());
        this.currentView = 'DAY'; // 'DAY', 'WEEK', 'MONTH', 'MACHINES', 'REQUESTS', 'BUSINESS', 'SUPERADMIN'
        this.listeners = [];
        this.unsubscribeFirestore = null;
    }

    async init() {
        // Escuchar cambios de autenticación
        authManager.subscribe(async (user, role) => {
            this.userRole = role;
            if (role === 'SUPERADMIN' && this.currentView === 'REQUESTS') {
                this.currentView = 'SUPERADMIN';
            }
            this.notify();
        });

        this.userRole = authManager.getRole();

        // Escuchar cambios de negocio activo
        tenantManager.subscribe(async (business) => {
            this.currentBusiness = business;
            await this.loadBusinessData();
            this.notify();
        });

        this.currentBusiness = tenantManager.getActiveBusiness();
        await this.loadBusinessData();
    }

    async loadBusinessData() {
        if (!this.currentBusiness) return;
        const bizId = this.currentBusiness.id;

        if (this.unsubscribeFirestore) {
            this.unsubscribeFirestore();
            this.unsubscribeFirestore = null;
        }

        let loadedMachines = [];
        let loadedReservations = [];

        if (isFirebaseAvailable && db) {
            try {
                const machQuery = query(collection(db, COLLECTIONS.MACHINES), where("businessId", "==", bizId));
                const machSnap = await getDocs(machQuery);
                machSnap.forEach(d => loadedMachines.push({ id: d.id, ...d.data() }));

                const resQuery = query(collection(db, COLLECTIONS.RESERVATIONS), where("businessId", "==", bizId));
                const resSnap = await getDocs(resQuery);
                resSnap.forEach(d => loadedReservations.push({ id: d.id, ...d.data() }));

                this.unsubscribeFirestore = onSnapshot(resQuery, (snapshot) => {
                    const realtimeRes = [];
                    snapshot.forEach(docSnap => {
                        realtimeRes.push({ id: docSnap.id, ...docSnap.data() });
                    });
                    this.reservations = realtimeRes;
                    this.saveLocalReservations(bizId, realtimeRes);
                    this.notify();
                });
            } catch (err) {
                console.warn("Error Firebase:", err);
            }
        }

        if (loadedMachines.length === 0) {
            const localMach = localStorage.getItem(`piu_machines_${bizId}`);
            if (localMach) {
                try { loadedMachines = JSON.parse(localMach); } catch (e) { loadedMachines = []; }
            }
        }

        if (loadedReservations.length === 0) {
            const localRes = localStorage.getItem(`piu_reservations_${bizId}`);
            if (localRes) {
                try { loadedReservations = JSON.parse(localRes); } catch (e) { loadedReservations = []; }
            }
        }

        if (loadedMachines.length === 0) {
            loadedMachines = DEFAULT_MACHINES_BY_BIZ[bizId] || [
                {
                    id: `mach_${bizId}_01`,
                    businessId: bizId,
                    name: 'PIU Phoenix Pro Cab',
                    model: 'LX 55" Pro',
                    version: 'Phoenix 2024',
                    status: 'AVAILABLE',
                    padsCondition: 'Calibrado y listo.',
                    hourlyRate: 100,
                    imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
                    features: ['55" Display', 'AM.PASS'],
                    createdAt: new Date().toISOString()
                }
            ];
            this.saveLocalMachines(bizId, loadedMachines);
            this.syncMachinesToFirebase(loadedMachines);
        }

        if (loadedReservations.length === 0) {
            loadedReservations = createDemoReservations(bizId);
            this.saveLocalReservations(bizId, loadedReservations);
            this.syncReservationsToFirebase(loadedReservations);
        }

        this.machines = loadedMachines;
        this.reservations = loadedReservations;
    }

    saveLocalMachines(bizId, machines) {
        localStorage.setItem(`piu_machines_${bizId}`, JSON.stringify(machines));
    }

    saveLocalReservations(bizId, reservations) {
        localStorage.setItem(`piu_reservations_${bizId}`, JSON.stringify(reservations));
    }

    async syncMachinesToFirebase(machines) {
        if (!isFirebaseAvailable || !db) return;
        for (const m of machines) {
            try { await setDoc(doc(db, COLLECTIONS.MACHINES, m.id), m); } catch (e) {}
        }
    }

    async syncReservationsToFirebase(reservations) {
        if (!isFirebaseAvailable || !db) return;
        for (const r of reservations) {
            try { await setDoc(doc(db, COLLECTIONS.RESERVATIONS, r.id), r); } catch (e) {}
        }
    }

    getMachines() {
        return this.machines;
    }

    getActiveMachines() {
        return this.machines.filter(m => m.status === 'AVAILABLE');
    }

    getMachineById(id) {
        return this.machines.find(m => m.id === id);
    }

    getReservations(filter = {}) {
        let result = [...this.reservations];
        if (filter.date) result = result.filter(r => r.date === filter.date);
        if (filter.machineId) result = result.filter(r => r.machineId === filter.machineId);
        if (filter.status) result = result.filter(r => r.status === filter.status);
        if (filter.excludeRejectedCancelled) {
            result = result.filter(r => r.status !== 'REJECTED' && r.status !== 'CANCELLED');
        }
        return result;
    }

    getPendingRequests() {
        return this.reservations.filter(r => r.status === 'PENDING')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    getPendingRequestsCount() {
        return this.getPendingRequests().length;
    }

    checkAvailability(machineId, date, startTime, endTime, excludeReservationId = null) {
        const machine = this.getMachineById(machineId);
        if (!machine || machine.status === 'OUT_OF_ORDER') {
            return { available: false, reason: 'La máquina se encuentra fuera de servicio.' };
        }

        const existing = this.getReservations({ date, machineId, excludeRejectedCancelled: true });

        for (const res of existing) {
            if (excludeReservationId && res.id === excludeReservationId) continue;
            if (isOverlapping(startTime, endTime, res.startTime, res.endTime)) {
                return {
                    available: false,
                    reason: `Conflicto con la reservación de ${res.clientName} (${res.startTime} - ${res.endTime})`,
                    conflictingReservation: res
                };
            }
        }
        return { available: true };
    }

    getMonthReservationsCount(year, month) {
        const counts = {};
        this.reservations.forEach(r => {
            if (r.status === 'REJECTED' || r.status === 'CANCELLED') return;
            const [y, m, d] = r.date.split('-').map(Number);
            if (y === year && m === (month + 1)) {
                counts[r.date] = (counts[r.date] || 0) + 1;
            }
        });
        return counts;
    }

    async requestReservation(bookingData) {
        const availability = this.checkAvailability(
            bookingData.machineId,
            bookingData.date,
            bookingData.startTime,
            bookingData.endTime
        );

        if (!availability.available) throw new Error(availability.reason);

        const machine = this.getMachineById(bookingData.machineId);
        const hours = (bookingData.durationMinutes || 60) / 60;
        const totalCost = Math.round(hours * (machine ? machine.hourlyRate : 100));
        const isStaff = this.userRole === 'MANAGER' || this.userRole === 'SUPERADMIN';

        const newReservation = {
            id: 'res_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            businessId: this.currentBusiness.id,
            machineId: bookingData.machineId,
            clientName: bookingData.clientName.trim(),
            clientPhone: bookingData.clientPhone ? bookingData.clientPhone.trim() : '',
            clientEmail: bookingData.clientEmail ? bookingData.clientEmail.trim() : '',
            date: bookingData.date,
            startTime: bookingData.startTime,
            endTime: bookingData.endTime,
            durationMinutes: bookingData.durationMinutes || 60,
            status: isStaff ? 'CONFIRMED' : 'PENDING',
            totalCost: totalCost,
            notes: bookingData.notes ? bookingData.notes.trim() : '',
            adminNotes: isStaff ? 'Asignada directamente por Encargado' : '',
            createdAt: new Date().toISOString()
        };

        this.reservations.push(newReservation);
        this.saveLocalReservations(this.currentBusiness.id, this.reservations);

        if (isFirebaseAvailable && db) {
            try { await setDoc(doc(db, COLLECTIONS.RESERVATIONS, newReservation.id), newReservation); } catch (err) {}
        }

        this.notify();
        return newReservation;
    }

    async approveReservation(reservationId, adminNotes = '') {
        const res = this.reservations.find(r => r.id === reservationId);
        if (!res) throw new Error("Reservación no encontrada");

        const availability = this.checkAvailability(res.machineId, res.date, res.startTime, res.endTime, res.id);
        if (!availability.available) throw new Error(`No se puede aprobar: ${availability.reason}`);

        res.status = 'CONFIRMED';
        res.adminNotes = adminNotes || 'Aprobada por el encargado.';
        res.updatedAt = new Date().toISOString();

        this.saveLocalReservations(this.currentBusiness.id, this.reservations);

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.RESERVATIONS, reservationId), {
                    status: 'CONFIRMED', adminNotes: res.adminNotes, updatedAt: res.updatedAt
                });
            } catch (e) {}
        }
        this.notify();
        return res;
    }

    async rejectReservation(reservationId, reason = '') {
        const res = this.reservations.find(r => r.id === reservationId);
        if (!res) throw new Error("Reservación no encontrada");

        res.status = 'REJECTED';
        res.rejectionReason = reason || 'Horario no disponible / Cancelada por encargado.';
        res.updatedAt = new Date().toISOString();

        this.saveLocalReservations(this.currentBusiness.id, this.reservations);

        if (isFirebaseAvailable && db) {
            try {
                await updateDoc(doc(db, COLLECTIONS.RESERVATIONS, reservationId), {
                    status: 'REJECTED', rejectionReason: res.rejectionReason, updatedAt: res.updatedAt
                });
            } catch (e) {}
        }
        this.notify();
        return res;
    }

    async modifyReservation(reservationId, updatedFields) {
        const res = this.reservations.find(r => r.id === reservationId);
        if (!res) throw new Error("Reservación no encontrada");

        const targetMachine = updatedFields.machineId || res.machineId;
        const targetDate = updatedFields.date || res.date;
        const targetStart = updatedFields.startTime || res.startTime;
        const targetEnd = updatedFields.endTime || res.endTime;

        const availability = this.checkAvailability(targetMachine, targetDate, targetStart, targetEnd, reservationId);
        if (!availability.available) throw new Error(availability.reason);

        Object.assign(res, updatedFields, {
            machineId: targetMachine,
            date: targetDate,
            startTime: targetStart,
            endTime: targetEnd,
            status: 'CONFIRMED',
            updatedAt: new Date().toISOString()
        });

        this.saveLocalReservations(this.currentBusiness.id, this.reservations);

        if (isFirebaseAvailable && db) {
            try { await updateDoc(doc(db, COLLECTIONS.RESERVATIONS, reservationId), updatedFields); } catch (e) {}
        }
        this.notify();
        return res;
    }

    async deleteReservation(reservationId) {
        this.reservations = this.reservations.filter(r => r.id !== reservationId);
        this.saveLocalReservations(this.currentBusiness.id, this.reservations);

        if (isFirebaseAvailable && db) {
            try { await deleteDoc(doc(db, COLLECTIONS.RESERVATIONS, reservationId)); } catch (e) {}
        }
        this.notify();
        return true;
    }

    async addMachine(machineData) {
        const newMachine = {
            id: 'mach_' + Date.now(),
            businessId: this.currentBusiness.id,
            name: machineData.name.trim(),
            model: machineData.model.trim(),
            version: machineData.version.trim(),
            status: machineData.status || 'AVAILABLE',
            padsCondition: machineData.padsCondition ? machineData.padsCondition.trim() : 'En buen estado.',
            hourlyRate: Number(machineData.hourlyRate) || 100,
            imageUrl: machineData.imageUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80',
            features: machineData.features || ['AM.PASS', 'HD Sound'],
            createdAt: new Date().toISOString()
        };

        this.machines.push(newMachine);
        this.saveLocalMachines(this.currentBusiness.id, this.machines);

        if (isFirebaseAvailable && db) {
            try { await setDoc(doc(db, COLLECTIONS.MACHINES, newMachine.id), newMachine); } catch (e) {}
        }
        this.notify();
        return newMachine;
    }

    async updateMachine(machineId, updatedFields) {
        const machine = this.machines.find(m => m.id === machineId);
        if (!machine) throw new Error("Máquina no encontrada");

        Object.assign(machine, updatedFields, { updatedAt: new Date().toISOString() });
        this.saveLocalMachines(this.currentBusiness.id, this.machines);

        if (isFirebaseAvailable && db) {
            try { await updateDoc(doc(db, COLLECTIONS.MACHINES, machineId), updatedFields); } catch (e) {}
        }
        this.notify();
        return machine;
    }

    async deleteMachine(machineId) {
        this.machines = this.machines.filter(m => m.id !== machineId);
        this.saveLocalMachines(this.currentBusiness.id, this.machines);

        if (isFirebaseAvailable && db) {
            try { await deleteDoc(doc(db, COLLECTIONS.MACHINES, machineId)); } catch (e) {}
        }
        this.notify();
        return true;
    }

    setCurrentView(view) {
        this.currentView = view;
        this.notify();
    }

    setSelectedDate(dateStr) {
        this.selectedDate = dateStr;
        this.notify();
    }

    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    notify() {
        this.listeners.forEach(cb => cb(this));
    }
}

export const store = new Store();
