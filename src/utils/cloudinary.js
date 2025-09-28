import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadImage = async (filePath) => {
    try {
        if(!filePath){
            throw new Error("File path is required");
        }
        const response = await cloudinary.uploader.upload(filePath, {
            resource_type: 'auto',
        });

        fs.unlinkSync(filePath); // remove file from server/localStorage after upload

        return response;

    } catch (error) {
        fs.unlinkSync(filePath); // remove file from server/localStorage if error occurs
        console.error("Error uploading to Cloudinary:", error);
        throw error;        
    }
}

const deleteImage = async (publicId) => {
    try {
        const response = await cloudinary.uploader.destroy(publicId);
        return response;
    } catch (error) {
        console.error("Error deleting from Cloudinary:", error);
        throw {result: "error" };        
    }
}


export {uploadImage, deleteImage};