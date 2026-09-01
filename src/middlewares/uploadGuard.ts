import multer from 'multer';

export const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('wav') || file.mimetype.includes('webm') || file.mimetype.includes('octet-stream')) {
      cb(null, true);
    } else {
      cb(new Error('INVALID_AUDIO_FORMAT'));
    }
  },
});