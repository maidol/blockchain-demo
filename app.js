const http = require('http');
const Koa = require('koa');
const KoaRouter = require('koa-router');
const BodyParse = require('koa-bodyparser');

const BlockChain = require('./blockchain');

const bc = new BlockChain();
const app = new Koa();
const router = new KoaRouter();

// 创建交易
router.post('/transactions', (ctx, next) => {
  let { sender, recipient, amount } = ctx.request.body;
  if(!ctx.request.body || !sender || !recipient || !amount) ctx.throw(400, '错误的请求参数');
  let index = bc.newTransaction(sender, recipient, amount);
  ctx.body = { index };
});

// 挖矿，记录
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

// 查询区块链
router.get('/chain', (ctx, next) => {
  ctx.body = {
    'chain': bc.chain,
    'length': bc.chain.length,
  };
})

// 注册节点
router.post('/nodes', (ctx, next) => {
  let nodes = ctx.request.body;
  nodes.forEach(el => {
    if(el) bc.registerNode(el);
  });
  ctx.body = { ok: 1 };
})

// 共识，同步区块链
router.get('/nodes/resolve', async (ctx, next) => {
  let replaced = await bc.resolveConflicts();
  if(replaced) {
    return ctx.body = { ok: 1 };
  }
  return ctx.body = { ok: 0 };
});

app.use(new BodyParse());
app.use(router.routes());

const server = http.createServer(app.callback());
const PORT = process.env.PORT || 8000
server.listen( PORT, function(){
  console.log(`listenning on ${PORT}`);
});