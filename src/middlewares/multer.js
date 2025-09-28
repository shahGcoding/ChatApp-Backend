import multer from 'multer';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public"); // Specify the directory to store uploaded files
  },
  filename: (req, file, cb) => {
   // cb(null, file.originalname); // Use the original filename
   cb(null, Date.now() + "-" + file.originalname);
},
});

export const upload = multer({
  storage: storage, 
})
