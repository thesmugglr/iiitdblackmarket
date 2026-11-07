import {test} from 'node:test'
import assert from 'node:assert/strict'
import {nearChatBottom,shouldFollowChat} from '../src/lib/chatScroll.ts'
test('incoming messages preserve a reader who scrolled back',()=>{assert.equal(shouldFollowChat('a','b',false,false),false)})
test('initial and own messages follow the end',()=>{assert.equal(shouldFollowChat(null,'a',false,false),true);assert.equal(shouldFollowChat('a','b',true,false),true)})
test('read-receipt refresh cannot pull a reader down to an old own message',()=>{assert.equal(shouldFollowChat('a','a',true,false),false)})
test('near-bottom tolerance follows the message viewport only',()=>{assert.equal(nearChatBottom({scrollHeight:1000,scrollTop:650,clientHeight:300}),true);assert.equal(nearChatBottom({scrollHeight:1000,scrollTop:100,clientHeight:300}),false)})
