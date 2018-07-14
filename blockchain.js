const crypto = require('crypto');
const uuid = require('node-uuid');
const rp = require('request-promise-native')

const CHAIN = Symbol('#CHAIN');
const CURRENT_TRANSACTIONS = Symbol('#CURRENT_TRANSACTIONS');
const NODE_IDENTIFIER = Symbol('#NODE_IDENTIFIER');

/**
 * BlockChain
 * 用以管理链条，存储交易，加入新区块
 */
class BlockChain {
  constructor(){
    this[NODE_IDENTIFIER] = uuid.v1().replace('-', '');
    this.nodes = new Set(['localhost:8000', 'localhost:5000', 'localhost:5001']);
    this[CHAIN] = [];
    this[CURRENT_TRANSACTIONS] = [];
    this.newBlock(1, 100);
  }
  get chain(){
    return this[CHAIN];
  }
  set chain(val){
    this[CHAIN] = val;
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
  newTransaction(sender, recipient, amount){
    this[CURRENT_TRANSACTIONS].push({
      sender,
      recipient,
      amount,
    });
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
   * 注册节点
   * @param {http://localhost:5000} node 
   */
  registerNode(node){
    this.nodes.add(node);
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
   * 同步区块链
   *
   * @returns
   * @memberof BlockChain
   */
  async resolveConflicts(){
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
      this.chain = newChain;
      return true;
    }
    return false;
  }
}

module.exports = BlockChain;