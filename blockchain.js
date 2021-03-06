const crypto = require('crypto');
const uuid = require('node-uuid');
const rp = require('request-promise-native')

const CHAIN = Symbol('#CHAIN');
const CURRENT_TRANSACTIONS = Symbol('#CURRENT_TRANSACTIONS');
const NODE_IDENTIFIER = Symbol('#NODE_IDENTIFIER');

/**
 * BlockChain
 * 用以管理链条，存储交易，加入新区块
 *
 * @class BlockChain
 */
class BlockChain {
  /**
   *Creates an instance of BlockChain.
   * @param { node当前节点, seedNodes种子节点 } { node, seedNodes = ['localhost:8000'] }
   * @memberof BlockChain
   */
  constructor({ node, seedNodes = ['localhost:8000'] }){
    this[NODE_IDENTIFIER] = uuid.v1().replace(/-/g, '');
    this.nodes = new Set(seedNodes.filter(el => el !== node));
    this[CHAIN] = [];
    this[CURRENT_TRANSACTIONS] = [];
    this.newBlock(1, 100);
    this.current = node;
    this.init();
  }
  /**
   * 初始化
   *
   * @memberof BlockChain
   */
  init(){}
  get chain(){
    return this[CHAIN];
  }
  get transactions(){
    return this[CURRENT_TRANSACTIONS];
  }
  get nodeIdentifier(){
    return this[NODE_IDENTIFIER];
  }
  newBlock(proof, previousHash){
    const block = {
      'index': this[CHAIN].length + 1,
      'timestamp': Math.floor(Date.now()/1000),
      'transactions': this[CURRENT_TRANSACTIONS],
      'proof': proof,
      'previousHash': previousHash || this.hash(this[CHAIN][this[CHAIN].length - 1]),
    };

    this[CURRENT_TRANSACTIONS] = [];
    this[CHAIN].push(block);
    return block;
  }
  newTransaction(sender, recipient, amount, tid, fromNode, isSelfMined){
    if(this[CURRENT_TRANSACTIONS].find(el => el.tid === tid) || fromNode === this.current){
      return;
    }
    let transaction = {
      tid: tid || uuid.v1().replace(/-/g, ''),
      sender,
      recipient,
      amount,
    };
    this[CURRENT_TRANSACTIONS].push(transaction);
    // 通知新增交易
    if(!isSelfMined) this.notify('newTransaction', transaction, fromNode || this.current);
    return this.lastBlock().index + 1;
  }
  hash(block){
    const keys = Object.keys(block).sort();
    const blockStrings = keys.map(k => `${k}=${ typeof block[k] === 'String' ? block[k] : JSON.stringify(block[k])}`).join('&');
    const sha256 = crypto.createHash('sha256');
    return sha256.update(blockStrings).digest('hex');
  }
  lastBlock(){
    return this[CHAIN][this[CHAIN].length - 1];
  }
  pow(lastProof = 0){
    let proof = 0;
    while(!this.validProof(lastProof, proof)){
      proof++;
    }
    return proof;
  }
  validProof(lastProof, proof){
    // 寻找一个数 proof，使得它与前一个区块的 lastProof 拼接成的字符串的 Hash 值以 4 个零开头
    let guessHash = crypto.createHash('sha256').update(`${lastProof}${proof}`).digest('hex');
    return guessHash.slice(guessHash.length - 4) === '0000';
  }
  /**
   * 挖矿
   *
   * @returns
   * @memberof BlockChain
   */
  mine(){
    this.newTransaction(
      0,
      this.nodeIdentifier,
      1,
      uuid.v1().replace(/-/g, ''),
      undefined,
      true,
    );
    let lastBlock = this.lastBlock();
    let lastProof = lastBlock['proof'];
    let proof = this.pow(lastProof);
    let block = this.newBlock(proof);
    this.notify('syncChain');
    return block;
  }
  join(){
    this.notify('join', this.current);
    // 同步节点列表
    this.syncNodes();
    // 同步区块链
    this.resolveConflicts(true);
  }
  async syncNodes(){
    let ps = [...this.nodes].map(el => {
      return rp.get(`http://${el}/nodes`, { json: true });
    });
    let nodesList = await Promise.all(ps);
    nodesList.forEach(nsl => {
      nsl.forEach(node => {
        if(node !== this.current){
          this.nodes.add(node);
        }
      });
    });
    console.log('syncNodes', [...this.nodes]);
  }
  /**
   * 注册节点
   *
   * @param {*} node
   * @memberof BlockChain
   */
  registerNode(node){
    if(!this.nodes.has(node) && this.current !== node){
      this.notify('join', node); // 通知其他节点有新节点加入
      this.nodes.add(node);
    }
  }
  /**
   * 验证区块链有效性
   * 遍历每个块验证hash和proof
   * @param {*} chain
   * @memberof BlockChain
   */
  validChain(chain){
    let lastBlock = chain[0];
    let currentIndex = 1;

    while(currentIndex < chain.length){
      let block = chain[currentIndex];
      console.log(lastBlock);
      console.log(block);
      console.log('\n---------------\n');
      if(block['previousHash'] !== this.hash(lastBlock)){
        return false;
      }
      if(!this.validProof(lastBlock['proof'], block['proof'])){
        return false;
      }

      lastBlock = block;
      currentIndex++;
    }
    return true;
  }
  /**
   * 共识，同步区块链
   *
   * @returns
   * @memberof BlockChain
   */
  async resolveConflicts(isNewNode){
    let neighbours = this.nodes;
    let newChain;

    let maxLength = this.chain.length;

    let prs = [...neighbours].map(el => {
      try {
        return rp.get(`http://${el}/chain`, { json: true });
      } catch (error) {
        return void 0;
      }
    });
    let results = await Promise.all(prs);
    results.forEach(el => {
      if(!el) return;
      let { length, chain } = el;
      if(length > maxLength && this.validChain(chain)){
        maxLength = length;
        newChain = chain;
      }
    });
    if(newChain){
      this[CHAIN] = newChain;
      if(!isNewNode){
        // 通知其他节点，同步
        this.notify('syncChain');
      }
      return true;
    }
    return false;
  }
  /**
   * 广播消息
   *
   * @param { 消息类型 } action
   * @memberof BlockChain
   */
  notify(action, data, fromNode){
    switch (action) {
      case 'syncChain': // 挖矿成功
        [...this.nodes].filter(el => el !== this.current).map(el => {
          try {
            console.log(`syncChain, notify to ${el}`);
            return rp.get(`http://${el}/nodes/resolve`);
          } catch (error) {
            return void 0;
          }
        });
        break;
      case 'join': // 新节点加入
        [...this.nodes].filter(el => el !== this.current).map(el => {
          try {
            console.log(`join, notify to ${el}`);
            return rp.post(`http://${el}/nodes`, { json: true, body: [ data ] });
          } catch (error) {
            return void 0;
          }
        });
        break;
      case 'newTransaction': // 同步交易
        [...this.nodes].filter(el => el !== this.current || el !== fromNode).map(el => {
          try {
            console.log(`newTransaction, from ${fromNode}, notify to ${el}`);
            return rp.post(`http://${el}/transactions?fromNode=${this.current}`, { json: true, body: data });
          } catch (error) {
            return void 0;
          }
        });
        break;
      default:
        break;
    }
  };
}

module.exports = BlockChain;