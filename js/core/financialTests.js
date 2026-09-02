// js/core/financialTests.js
// Suite de Pruebas Automatizadas de Escenarios Financieros, Seguridad e Idempotencia (E1 - E7)
import { accountManager } from './accountManager.js';
import { auditLogger, AUDIT_ACTIONS } from './auditLogger.js';
import { handleAppError, formatErrorMessage } from './errorHandler.js';
import { db, isFirebaseAvailable, COLLECTIONS, doc, getDoc, setDoc } from '../firebaseConfig.js';
import { toast } from '../components/toast.js';

export async function runFinancialTestSuite() {
    console.log("=================================================================");
    console.log("🧪 INICIANDO SUITE DE PRUEBAS DE BLINDAJE FINANCIERO (E1 - E7)");
    console.log("=================================================================");

    const results = [];
    const testBusinessId = 'biz_test_audit_suite';
    const testPlayerId = `player_test_${Date.now()}`;

    // Helper para registrar resultado
    function recordResult(testId, name, passed, details = '') {
        const item = { testId, name, passed, details };
        results.push(item);
        if (passed) {
            console.log(`✅ [${testId}] ${name}: PASÓ ${details ? `(${details})` : ''}`);
        } else {
            console.error(`❌ [${testId}] ${name}: FALLÓ ${details ? `(${details})` : ''}`);
        }
    }

    try {
        // ---------------------------------------------------------------------
        // PRUEBA E1: Idempotencia Persistente en Ventas (Anti-Doble Cobro)
        // ---------------------------------------------------------------------
        const testIdempotencyKey = `idem_test_${Date.now()}`;
        const saleParams = {
            businessId: testBusinessId,
            playerId: testPlayerId,
            playerName: 'Jugador Test E1',
            items: [{ name: 'Bebida Energética', unitPrice: 35, quantity: 2, category: 'bebida' }],
            paymentStatus: 'PENDING',
            paymentMethod: 'CASH',
            idempotencyKey: testIdempotencyKey
        };

        // Primer envío: Debe tener éxito
        const sale1 = await accountManager.recordSale(saleParams);

        // Segundo envío (simulando doble clic o reintento de red con la misma IdempotencyKey):
        // Debe retornar el registro existente sin duplicar la deuda acumulada del jugador
        const sale2 = await accountManager.recordSale(saleParams);
        const accountAfterE1 = await accountManager.getPlayerAccount(testBusinessId, testPlayerId);

        // Deuda esperada: exactamente $70 (NO $140 por duplicación)
        const e1Passed = (sale1?.id === sale2?.id) && (accountAfterE1.netDebt === 70);

        recordResult(
            'E1', 
            'Idempotencia Persistente en Firestore (Cero Cobros Duplicados)', 
            e1Passed,
            `Venta 1 ID: ${sale1?.id} | Venta 2 ID: ${sale2?.id} | Deuda resultante: $${accountAfterE1.netDebt} (Esperado: $70)`
        );

        // ---------------------------------------------------------------------
        // PRUEBA E2: Registro de Abono Transaccional y Recálculo de Saldo
        // ---------------------------------------------------------------------
        const payParams = {
            businessId: testBusinessId,
            playerId: testPlayerId,
            playerName: 'Jugador Test E1',
            amount: 50,
            paymentMethod: 'CASH',
            notes: 'Abono parcial de prueba'
        };

        const payment = await accountManager.recordPayment(payParams);
        const accountAfterPay = await accountManager.getPlayerAccount(testBusinessId, testPlayerId);

        // Deuda inicial: $70. Abono: $50. Saldo neto esperado: $20.
        const expectedDebt = 20;
        const e2Passed = (payment?.totalAmount === 50) && (accountAfterPay.netDebt === expectedDebt);

        recordResult(
            'E2',
            'Abono Transaccional y Balance Neto',
            e2Passed,
            `Deuda viva resultante: $${accountAfterPay.netDebt} (Esperado: $${expectedDebt})`
        );

        // ---------------------------------------------------------------------
        // PRUEBA E3: Inmutabilidad y Anulación Formal (VOIDED sin borrado físico)
        // ---------------------------------------------------------------------
        const voidReason = "Error en captura de prueba de auditoría";
        const voidResult = await accountManager.voidTransaction(testBusinessId, testPlayerId, sale1.id, {
            reason: voidReason,
            actor: 'Superadmin Test'
        });

        const accountAfterVoid = await accountManager.getPlayerAccount(testBusinessId, testPlayerId);
        
        // Al anular la venta fiada de $70, y teniendo un abono de $50, el saldo a favor es $50 (netDebt = $0).
        const e3Passed = voidResult === true && accountAfterVoid.netDebt === 0 && accountAfterVoid.creditBalance === 50;

        recordResult(
            'E3',
            'Anulación Formal VOIDED (Cero Borrado Físico)',
            e3Passed,
            `Transacción marcada como VOIDED | Deuda neta tras anulación: $${accountAfterVoid.netDebt} | Saldo a favor: $${accountAfterVoid.creditBalance}`
        );

        // ---------------------------------------------------------------------
        // PRUEBA E4: Auditoría Obligatoria en piu_audit_logs
        // ---------------------------------------------------------------------
        const auditLogs = await auditLogger.getLogs(testBusinessId, { maxResults: 10 });
        const hasSaleLog = auditLogs.some(l => l.action === AUDIT_ACTIONS.SALE_RECORDED);
        const hasPayLog = auditLogs.some(l => l.action === AUDIT_ACTIONS.PAYMENT_RECORDED);
        const hasVoidLog = auditLogs.some(l => l.action === AUDIT_ACTIONS.TRANSACTION_VOIDED);

        const e4Passed = hasSaleLog && hasPayLog && hasVoidLog;
        recordResult(
            'E4',
            'Trazabilidad en piu_audit_logs (Venta + Abono + Anulación)',
            e4Passed,
            `Logs generados: Venta=${hasSaleLog}, Abono=${hasPayLog}, Anulación=${hasVoidLog}`
        );

        // ---------------------------------------------------------------------
        // PRUEBA E5: Manejo Transparente de Errores (Cero errores ocultos)
        // ---------------------------------------------------------------------
        const simulatedError = { code: 'permission-denied', message: 'Missing or insufficient permissions' };
        const translatedMsg = formatErrorMessage(simulatedError, "Operación no autorizada");
        const e5Passed = translatedMsg.includes("Acceso denegado") && translatedMsg.includes("reglas de seguridad");

        recordResult(
            'E5',
            'Mapeo Transparente de Errores (errorHandler.js)',
            e5Passed,
            `Traducción generada: "${translatedMsg}"`
        );

        // ---------------------------------------------------------------------
        // PRUEBA E6: Rechazo de Montos Inválidos o Negativos
        // ---------------------------------------------------------------------
        let negativeAmountBlocked = false;
        try {
            await accountManager.recordPayment({
                businessId: testBusinessId,
                playerId: testPlayerId,
                amount: -100
            });
        } catch (err) {
            negativeAmountBlocked = true;
        }

        recordResult(
            'E6',
            'Rechazo de Importes Negativos / Inválidos',
            negativeAmountBlocked,
            `Intento de cobro/abono -$100 bloqueado correctamente: ${negativeAmountBlocked}`
        );

        // ---------------------------------------------------------------------
        // PRUEBA E7: Alias de Seguridad deleteTransaction -> voidTransaction
        // ---------------------------------------------------------------------
        // Creamos una venta y probamos que deleteTransaction NO borra el documento sino que lo anula
        const saleToDelete = await accountManager.recordSale({
            businessId: testBusinessId,
            playerId: testPlayerId,
            items: [{ name: 'Fichas PIU', unitPrice: 20, quantity: 1, category: 'ficha' }],
            paymentStatus: 'PAID',
            paymentMethod: 'CASH'
        });

        await accountManager.deleteTransaction(testBusinessId, testPlayerId, saleToDelete.id, "Prueba de alias seguro");
        const txList = await accountManager.getPlayerTransactions(testBusinessId, testPlayerId);
        const targetTx = txList.find(t => t.id === saleToDelete.id);

        const e7Passed = targetTx !== undefined && targetTx.status === 'VOIDED';
        recordResult(
            'E7',
            'Guardián de Inmutabilidad (deleteTransaction -> VOIDED sin pérdida de datos)',
            e7Passed,
            `Documento ${saleToDelete.id} preservado con status: "${targetTx?.status}"`
        );

    } catch (globalErr) {
        console.error("Error global en suite de pruebas:", globalErr);
        recordResult('GLOBAL', 'Ejecución de Suite de Pruebas', false, globalErr.message);
    }

    console.log("=================================================================");
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    console.log(`🏁 RESUMEN: ${passedCount}/${totalCount} PRUEBAS SUPERADAS EXITOSAMENTE`);
    console.log("=================================================================");

    if (typeof toast !== 'undefined' && toast.success) {
        toast.success(`Suite Financiera: ${passedCount}/${totalCount} pruebas pasadas.`);
    }

    return {
        total: totalCount,
        passed: passedCount,
        failed: totalCount - passedCount,
        details: results
    };
}

// Exponer en window para ejecución interactiva desde DevTools
if (typeof window !== 'undefined') {
    window.runFinancialTests = runFinancialTestSuite;
}
