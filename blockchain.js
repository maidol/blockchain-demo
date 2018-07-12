const crypto = require('crypto');
const uuid = require('node-uuid');

const CHAINS = Symbol('#CHAINS');
const CURRENT_TRANSACTIONS = Symbol('#CURRENT_TRANSACTIONS');
const NODE_IDENTIFIER = Symbol('#NODE_IDENTIFIER');

/**
 * BlockChain
 * 用以管理链条，存储交易，加入新区块
 */
class BlockChain {
  constructor(){
    this[NODE_IDENTIFIER] = uuid.v1().replace('-', '');
    this.nodes = new Set();
    this[CHAINS] = [];
    this[CURRENT_TRANSACTIONS] = [];
    this.newBlock(1, 100);
  }
  get chains(){
    return this[CHAINS];
  }
  get nodeIdentifier(){
    return this[NODE_IDENTIFIER];
  }
  newBlock(proof, previousHash){
    const block = {
      'index': this[CHAINS].length + 1,
      'timestamp': Math.floor(Date.now()/1000),
      'transactions': this[CURRENT_TRANSACTIONS],
      'proof': proof,
      'previousHash': previousHash || this.hash(this[CHAINS][this[CHAINS].length - 1]),
    };

    this[CURRENT_TRANSACTIONS] = [];
    this[CHAINS].push(block);
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
    return this[CHAINS][this[CHAINS].length - 1];
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
  validChain(chain){}
  resolveConflicts(){}

}

module.exports = BlockChain;