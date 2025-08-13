import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com', // Correto para Office 365 empresarial
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORDEMAIL // Ou app password se tiver MFA
    }
});

async function enviarEmail(destinatario,assunto,corpo) {
    try{
         const info = await transporter.sendMail({
            from: '"Pedro - Norte MKT" <pedro.santos@nortemkt.com>', // Melhor identificação
            to: destinatario,
            subject: assunto,
            text: corpo
        });
        return info;    
    }catch(err){
        return err
    }
}

export default enviarEmail;