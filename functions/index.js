const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.serveLocalMetadata = functions.https.onRequest(async (req, res) => {
    const pathParts = req.path.split('/');
    const localId = pathParts[pathParts.length - 1] || req.query.local;

    let title = "SKY GAMES • Pump It Up Hub";
    let description = "Reserva tu sesión de Pump It Up en nuestros gabinetes profesionales. ¡Únete a la comunidad!";
    let imageUrl = "https://magi-suite.web.app/images/default-share.jpg"; // URL por defecto para previsualizaciones

    if (localId && localId.startsWith("biz_")) {
        try {
            const docSnap = await admin.firestore().collection("piu_businesses").doc(localId).get();
            if (docSnap.exists) {
                const data = docSnap.data();
                title = `${data.name} • Reservaciones`;
                description = `Reserva tu gabinete en ${data.name}. Ubicación: ${data.address || data.city || 'Ver ubicación'}. Horarios: ${data.openingTime || '11:00'} - ${data.closingTime || '22:00'}.`;
                if (data.logo) {
                    imageUrl = data.logo;
                } else if (data.imageUrl) {
                    imageUrl = data.imageUrl;
                }
            }
        } catch (err) {
            console.error("Error obteniendo metadatos del local:", err);
        }
    }

    // Plantilla HTML optimizada para crawlers (WhatsApp, Facebook, Discord, etc.)
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    
    <!-- Open Graph Metadata para WhatsApp, Facebook, Telegram -->
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${imageUrl}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://magi-suite.web.app/local/${localId}">
    
    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${imageUrl}">

    <script>
        // Redirigir de inmediato al cliente de la SPA pasando el parámetro de local
        window.location.href = "/?local=${localId}";
    </script>
</head>
<body style="background:#0a0a0f; color:#fff; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0;">
    <div style="text-align:center;">
        <h2>Cargando local...</h2>
        <p>Redirigiendo a la plataforma de reservaciones de SKY GAMES.</p>
    </div>
</body>
</html>`;

    res.status(200).send(html);
});
