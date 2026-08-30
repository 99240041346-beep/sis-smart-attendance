const express=require('express');const router=express.Router();const {query}=require('./db');const auth=require('./middleware/auth');router.use(auth);
router.get('/fees',async(req,res,next)=>{try{const r=await query(`SELECT id,academic_year,semester,fee_type,amount,paid_amount,balance,due_date,status,receipt_number,updated_at FROM fee_accounts WHERE student_id=$1 ORDER BY due_date NULLS LAST`,[req.user.id]);res.json(r.rows)}catch(e){next(e)}});
router.get('/payments',async(req,res,next)=>{try{const r=await query(`SELECT id,fee_account_id,amount,status,gateway_reference,receipt_number,paid_at FROM fee_payments WHERE student_id=$1 ORDER BY created_at DESC`,[req.user.id]);res.json(r.rows)}catch(e){next(e)}});
module.exports=router;
