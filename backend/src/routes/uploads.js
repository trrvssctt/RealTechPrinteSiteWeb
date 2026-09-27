const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const cloudinary = require('../config/cloudinary');

// Dossiers autorisés dans Cloudinary (évite les chemins arbitraires)
const ALLOWED_FOLDERS = ['products', 'categories', 'services', 'misc'];

// Taille max acceptée (le base64 ajoute ~33% : 5MB fichier ≈ 6.7MB en base64)
const MAX_DATA_URL_LENGTH = 7.5 * 1024 * 1024;

// POST /api/uploads — { image: dataURL, folder?: string, alt?: string }
router.post('/', adminAuth, async (req, res, next) => {
  try {
    const { image, folder } = req.body;

    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'image (data URL) requise' });
    }
    if (!/^data:image\/(png|jpe?g|webp|gif|avif);base64,/.test(image)) {
      return res.status(400).json({ error: 'Format invalide. Formats acceptés : PNG, JPG, WebP, GIF, AVIF.' });
    }
    if (image.length > MAX_DATA_URL_LENGTH) {
      return res.status(413).json({ error: 'Image trop volumineuse (max 5MB).' });
    }

    const targetFolder = ALLOWED_FOLDERS.includes(folder) ? folder : 'misc';

    const result = await cloudinary.uploader.upload(image, {
      folder: `realtech/${targetFolder}`,
      resource_type: 'image',
      // Optimisation automatique à la livraison (format + qualité)
      transformation: [{ fetch_format: 'auto', quality: 'auto' }],
    });

    res.status(201).json({
      data: {
        url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        format: result.format,
      },
    });
  } catch (err) {
    console.error('[Cloudinary] Upload error:', err.message);
    next(err);
  }
});

module.exports = router;
