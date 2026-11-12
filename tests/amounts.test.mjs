import test from 'node:test';
import assert from 'node:assert/strict';
import {toYocto,fromYocto,makeRecipients,validAccount} from '../src/amounts.mjs';
test('NEAR amounts round trip without floating point loss',()=>{
  for(const v of ['0','0.1','1','0.000000000000000000000001','123456789.123456789123456789123456'])assert.equal(fromYocto(toYocto(v)),v);
  for(const v of ['-1','1e3','Infinity','1.0000000000000000000000001','01',''])assert.throws(()=>toYocto(v));
});
test('recipient funding supports overrides and rejects duplicates',()=>{
  assert.deepEqual(makeRecipients([{account:'alice.testnet',amount:''},{account:'bob.testnet',amount:'2'}],'10'),[{account_id:'alice.testnet',amount:toYocto('10').toString()},{account_id:'bob.testnet',amount:toYocto('2').toString()}]);
  assert.throws(()=>makeRecipients([{account:'alice.testnet'},{account:'alice.testnet'}],'1'));
  assert.throws(()=>makeRecipients([{account:'alice.testnet',amount:'0'}],'1'));
  assert.throws(()=>makeRecipients([],'1'));
});
test('NEAR account validation matches account ID separators',()=>{
  for(const id of ['alice.testnet','a-b_c.testnet','a'.repeat(64)])assert.ok(validAccount(id));
  for(const id of ['a','Alice.testnet','alice..testnet','-alice.testnet','alice@near','a'.repeat(65)])assert.equal(validAccount(id),false);
});
