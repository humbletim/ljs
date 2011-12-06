/** @license 
ljs - Lua VM in JavaScript
ljs.bytecode.js - binary chunk (bytecode/.luac) support
Copyright (c) 2010 Matthew Wild
extracted as sub-module 2011 Tim Dedischew
MIT license
*/

(function(exports) {

function LBinaryChunk(vm, chunk, start, sourceName)
{
	this.chunk = chunk;
	this.pos = start||12;
	
	this.sourceName = this.readString();
	if(sourceName)
		this.sourceName = sourceName;
	this.lineDefined = this.readInt();
	this.lastLineDefined = this.readInt();
	this.numUpvalues = this.readByte();
	this.numParameters = this.readByte();
	this.isVararg = this.readByte();
	this.maxStackSize = this.readByte();
	
	this.instructions = [];
	
	this.numInstructions = this.readInt();
	for(var i=0;i<this.numInstructions;i++)
	{
		var ins = this.readInt();
		this.instructions.push([
			ins&0x3F, // Opcode
			(ins>>6)&0xFF, // Field A
			(ins>>23)&0x1FF, // Field B
			(ins>>14)&0x1FF // Field C
		]);
		if(exports.debugMode)
		{
			var pi = this.instructions[this.instructions.length-1];
			//sys.puts("Pos: "+(this.pos-4)+" Ins: "+ins+" OP: "+INS_OPCODE(pi)+" A: "+INS_A(pi)+" B: "+INS_B(pi)+" C: "+INS_C(pi)+" Bx: "+INS_Bx(pi)+" sBx: "+(INS_Bx(pi)-0x1FFFE));
		}
	}
	
	this.constants = [];
	
	this.numConstants = this.readInt();
	var LValue = vm._LValue;
	for(var i=0;i<this.numConstants;i++)
	{
		var type = this.readByte();
		switch(type)
		{
		case 0: // Nil
			this.constants.push(new LValue(vm, "nil", null));
			break;
		case 1: // Boolean
			this.constants.push(new LValue(vm, "boolean", this.readByte())); // FIXME type
			break;
		case 3: // Number
			this.constants.push(new LValue(vm, "number", this.readNumber()));
			break;
		case 4: // String
			this.constants.push(new LValue(vm, "string", this.readString()));
			break;
		default:
			throw "Invalid constant type "+type+" in bytecode";
		}
	}
	
	this.prototypes = [];
	
	this.numPrototypes = this.readInt();
	for(var i=0;i<this.numPrototypes;i++)
	{
		var p = new LBinaryChunk(vm, chunk, this.pos, this.sourceName);
		this.pos = p.pos;
		this.prototypes.push(p);
	}
	
	this.sourceLines = [];
	
	this.numSourceLines = this.readInt();
	for(var i=0;i<this.numSourceLines;i++)
	{
		this.sourceLines.push(this.readInt());
	}
	
	this.localList = [];
	this.numLocalList = this.readInt();
	for(var i=0;i<this.numLocalList;i++)
	{
		this.localList.push([this.readString(),this.readInt(),this.readInt()]);
	}
	
	this.upvalueList = [];
	this.numUpvalueList = this.readInt();
	for(var i=0;i<this.numUpvalueList;i++)
	{
		this.upvalueList.push(this.readString());
	}
	
	return this;
}

LBinaryChunk.prototype = {
	readBytes: function (n)
	{
		return this.chunk.slice(this.pos, this.pos+=n);
	},
	readByte: function ()
	{
		return this.readBytes(1).charCodeAt(0);
	},
	readInt: function ()
	{
		//FIXME: Endianness
		return this.readByte() | (this.readByte()<<8)
			| (this.readByte()<<16) | (this.readByte()<<24);
	},
	readString: function ()
	{
		var len = this.readInt();
		return this.readBytes(len).substring(0,len-1);
	},
	readNumber: function ()
	{
		//FIXME: Endianness
		var bytes = [this.readByte(),this.readByte(),this.readByte(),this.readByte(),
		             this.readByte(),this.readByte(),this.readByte(),this.readByte()].reverse();
		
		var sign = (bytes[0]>>7)&0x1;
		var exp = (bytes[0]&0x7F)<<4 | (bytes[1]&0xf0)>>4;
		
		var frac = ((bytes[1] & 0x0f) * Math.pow(2,48))
		          + (bytes[2] * Math.pow(2,40))
		          + (bytes[3] * Math.pow(2,32))
		          + (bytes[4] * Math.pow(2,24))
		          + (bytes[5] * Math.pow(2,16))
		          + (bytes[6] * Math.pow(2,8))
		          +  bytes[7];
		
		if(exp != 0x000 && exp != 0x7FF)
		{
			var n = (sign==1?-1:1)*Math.pow(2,exp-1023)*(1+(frac/0x10000000000000));
			return n;
		}
		else if(exp == 0x000)
		{
			return sign*0;
		}
		else
			return frac==0?sign*Infinity:NaN;
	}
};

  exports.LBinaryChunk = LBinaryChunk;
  exports.loadbytecode = function (vm, bytes, env) {
	var c = new LBinaryChunk(vm, bytes);
	return vm.loadchunk(c, env);
// var f = new LFunction(this, c, env);
// 	  return new LValue(this, "function", f);
  };
  exports.luaopen_bytecode51 = function(VM, _G) {
	VM.loadbytecode = function(b, g) {
	  return exports.loadbytecode(this, b, g);
	};
	return true;
  };
  return exports;
})(typeof exports == 'object' ? exports : typeof window == 'object' ? window : {} );
