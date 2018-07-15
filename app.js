const http = require('http');
const Koa = require('koa');
const KoaRouter = require('koa-router');
const BodyParse = require('koa-bodyparser');

const PORT = process.env.PORT || 8000
const BlockChain = require('./blockchain');

const bc = new BlockChain({ node: `localhost:${PORT}` });
const app = new Koa();
const router = new KoaRouter();

// 创建交易
router.post('/transactions', (ctx, next) => {
  let { tid, sender, recipient, amount } = ctx.request.body;
  if(!ctx.request.body || !sender || !recipient || !amount) ctx.throw(400, '错误的请求参数');
  let index = bc.newTransaction(sender, recipient, amount, tid, ctx.query.fromNode);
  ctx.body = { index };
});

router.get('/transactions', (ctx, next) => {
  ctx.body = bc.transactions;
});

// 挖矿，记录
router.get('/mine', (ctx, next) => {
  // 挖矿
  let block = bc.mine();
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

router.get('/nodes', (ctx, next) => {
  ctx.body = [...bc.nodes];
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
server.listen( PORT, function(){
  console.log(`listenning on ${PORT}`);
  // 节点启动成功，加入区块链网络
  bc.join();
});