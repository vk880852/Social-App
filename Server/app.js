import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser';
const app=express();
app.use(cors(
));

app.use(express.json({
    limit:"16kb"
}))
app.use(express.urlencoded({
    limit:"16kb"
}))
app.use(cookieParser());
import userRouter from '../Server/routes/user.route.js'
app.use('/api/v1/users',userRouter);
export {app}
