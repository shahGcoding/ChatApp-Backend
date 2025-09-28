import nodemailer from 'nodemailer';


export const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: "shahzaibshahg90@gmail.com",
        pass: "fsdt fhap ikfi zwhn",
    },  
});