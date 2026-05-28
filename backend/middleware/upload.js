const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|avi|csv/;
  const ext = path.extname(file.originalname).toLowerCase();
  const isExtAllowed = allowed.test(ext);
  const isMimeAllowed = allowed.test(file.mimetype) || ext === '.csv';
  if (isExtAllowed && isMimeAllowed) return cb(null, true);
  cb(new Error('File type not allowed. Only images, videos, and CSVs are accepted.'));
};

const maxSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB || '50');

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeMB * 1024 * 1024 },
});

module.exports = upload;
