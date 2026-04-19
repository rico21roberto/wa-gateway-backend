const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(cookieParser());

//const authRoutes = require('./routes/auth');
//const ticketRoutes = require('./routes/ticket');

//app.use('/api/auth', authRoutes);
//app.use('/api/ticket', ticketRoutes);

app.get('/', (req,res)=>res.send('WA Gateway Secure Running'));
app.post('/api/ticket',(req, res) => {
    const { phone, message } = req.body;
    res.json({
        success: true,
        data: {
            phone,
            message
        }
    });
});
app.listen(3000, ()=>console.log('Server running on port 3000'));
