const http = require('http');
const Koa = require('koa');
const KoaRouter = require('koa-router');
const BodyParse = require('koa-bodyparser');

const BlockChain = require('./blockchain');

const bc = new BlockChain();
const app = new Koa();
const router = new KoaRouter();

router.post('/transactions', (ctx, next) => {
  let { sender, recipient, amount } = ctx.request.body;
  if(!ctx.request.body || !sender || !recipient || !amount) ctx.throw(400, '错误的请求参数');
  let index = bc.newTransaction(sender, recipient, amount);
  ctx.body = { index };
});

router.get('/mine', (ctx, next) => {
  bc.newTransaction({
    sender: 0,
    recipient: bc.nodeIdentifier,
    amount: 1,
  });
  let lastBlock = bc.lastBlock();
  let lastProof = lastBlock['proof'];
  let proof = bc.pow(lastProof);
  let block = bc.newBlock(proof);
  ctx.body = block;
});

router.get('/chain', (ctx, next) => {
  ctx.body = {
    'chain': bc.chains,
    'length': bc.chains.length,
  };
})

app.use(new BodyParse());
app.use(router.routes());

const server = http.createServer(app.callback());
server.listen(8000, function(){
  console.log('listenning on 8000');
});