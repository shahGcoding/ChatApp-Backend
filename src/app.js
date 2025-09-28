import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';


const app = express();

app.use(cors({origin: 'http://localhost:5173', credentials: true}));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({extended: true}));
app.use(express.static('public'));


// import routes here down
import userRoutes from './routes/user.routes.js';   
import messageRoutes from './routes/message.routes.js';


// routes declaration here down
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/messages', messageRoutes);



export {app};