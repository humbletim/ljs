// ljs/lvm.js -- Lua VM in Javascript

// Released under MIT/X11 license
// Copyright (c) 200x-2010 Matthew Wild
// Copyright (C) 2011 Tim Dedischew

// TODO: adapt into commonjs module

// EXAMPLE node: luac <input.lua> && node lvm.js
// EXAMPLE browser: see demo.html

var _VERSION = "Lua 5.1  {ljs=0.0011}"

// TODO: find a generic javascript logger
// SEE: demo.html for browser stubs
var sys=require("sys");

var OP_MOVE = 0;
var OP_LOADK = 1;
var OP_LOADBOOL = 2;
var OP_LOADNIL = 3;
var OP_GETUPVAL = 4;
var OP_GETGLOBAL = 5;
var OP_GETTABLE = 6;
var OP_SETGLOBAL = 7;
var OP_SETUPVAL = 8;
var OP_SETTABLE = 9;
var OP_NEWTABLE = 10;
var OP_SELF = 11;
var OP_ADD = 12;
var OP_SUB = 13;
var OP_MUL = 14;
var OP_DIV = 15;
var OP_MOD = 16;
var OP_POW = 17;
var OP_UNM = 18;
var OP_NOT = 19;
var OP_LEN = 20;
var OP_CONCAT = 21;
var OP_JMP = 22;
var OP_EQ = 23;
var OP_LT = 24;
var OP_LE = 25;
var OP_TEST = 26;
var OP_TESTSET = 27;
var OP_CALL = 28;
var OP_TAILCALL = 29;
var OP_RETURN = 30;
var OP_FORLOOP = 31;
var OP_FORPREP = 32;
var OP_TFORLOOP = 33;
var OP_SETLIST = 34;
var OP_CLOSE = 35;
var OP_CLOSURE = 36;
var OP_VARARG = 37;

var debugMode = false;

var logOP_VARG = sys.debug || function() {};

function LValue(vm, type, value)
{
	this.vm = vm;
	this.type = type||"nil";
	this.value = value;
}

LValue.prototype = {
	call: function (args)
	{
		var ret = this.vm.call(this, args);
		if(typeof(ret) == "undefined")
			ret = [];
		return ret;
	},
	precall: function ()
	{
		if(this.type == "function")
			return this.value;
		var func = this;
		if(func.type == "table" &&
		   func.metatable && func.metatable.type != "nil") {
		  var tfunc = this.metatable.index(this.vm.LValue("__call"));
		  if (tfunc.type == 'function') {
			return function() {
			  var cargs = [func].concat(Array.prototype.slice.call(arguments));
			  return tfunc.call(cargs);
			};
		  }
		}

		throw "Attempt to call a " + this.type + " value";
	},
	index: function (key, raw)
	{
//TODO: string metas like "val:find(" -> "string.find(val," -t
// 	  if (this.type == 'string' && raw != true) {
// 		if (key.value == "find")
// 		  sys.print( this.vm)
// 		return 
// 	  }

	  if(this.type == "table") {

		if (0 > "string number nil".indexOf(key.type))
		  throw "(TODO) ljs.table.index - sorry"+
			", table key can't be this type yet:"+key.type;

		// lua allows table[nil] for lookup
		if (key.type == 'nil') return this.vm.LValue(null); 

		// RE: lua tables vs. js Arrays 
		// in all js it seems non-int gets coerced to strings
		/*
		sys=require('sys');
		t=[]; t[1] = true; t[5.5] = 'fiver'; t[t] = true;
		sys.debug(sys.inspect(t))
		sys.debug("t.length:" + t.length);
		
		-> DEBUG: [ true, '5.5': 'fiver', ',true': true ]
		-> DEBUG: t.length:2
		*/

		// see: updated len() implementation
		var kv = key.value.toString();

		// .hasOwnProperty so "concat" doesn't pick up javascript:[].concat
		if((!this.value.hasOwnProperty && kv in this.value) ||
		   this.value.hasOwnProperty(kv)) {
		  if (typeof(this.value[kv]) == 'function')
			throw  "javascript key issue..."+kv+"="+typeof(this.value[kv]);
		  return this.value[kv];
		}
		if(raw != true && this.metatable && this.metatable.type != "nil") {
		  var __index = this._getMeta("__index");
		  if(__index.type == "function") {
			// VERIFY: looks like [0] already LValue or undefined...
			//     trying it without wrapping in another LValue -t
			var ret = /*this.vm.LValue(*/__index.call([this, key])[0] /*)*/;
			if (ret) return ret;
		  } else if(__index.type != "nil")
			return __index.index(key);
		}
		return this.vm.LValue(null);
	  } else
		throw "Attempt to index a " + this.type + " value";
	},
	setIndex: function (key, value, raw)
	{
	  if(this.type == "table") {
		var kv = key.value;
		if (key.type == 'number') kv = kv.toString();
		if ( !raw && this.metatable &&  !(
			   (!this.value.hasOwnProperty && kv in this.value) ||
			   this.value.hasOwnProperty(kv)
			 )) {
		  var metamethod = this._getMeta("__newindex");
		  if (metamethod)
			return metamethod.call([this,key,value]);
		}
		// match 0 vs. 1 indexing
		if (key.type == "number") {
		  this.value[kv] = value;
		}
		else if (key.type != 'string')
		  throw "(TODO) ljs.table.setIndex: for now indexes must be string or number, not: "+key.type;
		else this.value[key.value] = value;
	  } else
		throw "Attempt to index a " + this.type + " value";
	},
	setMetatable: function (metatable)
	{
		if(metatable.type == "table")
			this.metatable = metatable;
		else if(metatable.type == "nil")
			this.metatable = null;
		else
			throw "Attempt to set a "+metatable.type+" value as a metatable";
	},
	getMetatable: function ()
	{
	  return this.metatable;
	},
	_getMeta: function (jstr)
	{
	  //this.type == 'table' ?
	  if(this.metatable) {
		var __mm = this.vm.LValue(jstr);
		var meta = this.metatable.index(__mm);
		if (meta && meta.type != "nil")
		  return meta;
	  }
	  return false;
	},
	toString: function ()
	{
	  if (this.type == "nil") return "nil";
	  if (this.type == "function") return "function: 0xLVM";
	  
	  var metamethod = this._getMeta("__tostring");
	  if (metamethod)
		return metamethod.call([this]).toString();

	  if (this.type == "table") return "table: 0xLVM";

	  return this.value.toString();
	},
	truth: function ()
	{
		if(this.type == "nil" || (this.type == "boolean" && this.value == false))
			return false;
		return true;
	},
	add: function (op2)
	{
		var metamethod;
		var __add = this.vm.LValue("__add");
		if(this.metatable)
			metamethod = this.metatable.index(__add);
		if((!metamethod || metamethod.type == "nil") && op2.metatable)
			metamethod = op2.metatable.index(__add);
		if(metamethod && metamethod.type != "nil")
		{
			return metamethod.call([this, op2]);
		}
		else if((this.type == "number" || this.type == "string")
			&& (op2.type == "number" || op2.type == "string"))
		{
			// Plain addition
			return this.vm.LValue(parseFloat(this.value, 10) + parseFloat(op2.value, 10));
		}
		else
			throw "Attempt to perform arithmetic on a "+this.type+" and "+op2.type;
	},
	equals: function (op2)
	{
		if(this.type != op2.type)
			return false;
		if(this.value == op2.value)
			return true;
		var __eq = this.vm.LValue("__eq");
		if(this.metatable && op2.metatable)
		{
			var metamethod1 = this.metatable.index(__eq);
			var metamethod2 = op2.metatable.index(__eq);
			if(metamethod1.equals(metamethod2))
			{
				var result = metamethod1.call([this, op2]);
				return (result[0].type != "nil"
					&& (result[0].type != "boolean" || result[0].value == true)
				);
			}
		}
		return false;
	},
	len: function ()
	{
		switch(this.type)
		{
		case "string":
		return this.value.length;
		case "table": // FIXME: naive brute-force implementation...
		var i = 1;
		while (1) {
		  if (!this.value[i.toString()])
			return i-1;
		  i++;
		}
		default:
			throw "attempt to get length of a "+this.type+" value";
		}
	}
};

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
		if(debugMode)
		{
			var pi = this.instructions[this.instructions.length-1];
			//sys.puts("Pos: "+(this.pos-4)+" Ins: "+ins+" OP: "+INS_OPCODE(pi)+" A: "+INS_A(pi)+" B: "+INS_B(pi)+" C: "+INS_C(pi)+" Bx: "+INS_Bx(pi)+" sBx: "+(INS_Bx(pi)-0x1FFFE));
		}
	}
	
	this.constants = [];
	
	this.numConstants = this.readInt();
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

function INS_OPCODE(ins)
{
	return ins[0];
}

function INS_A(ins)
{
	return ins[1];
}

function INS_B(ins)
{
	return ins[2];
}

function INS_C(ins)
{
	return ins[3];
}

function INS_Bx(ins)
{
	return ((INS_C(ins))|(INS_B(ins)<<9));
}

function INS_sBx(ins)
{
	return (INS_Bx(ins)-0x1FFFF);
}

function RK(frame, R)
{
	var keysource = (R&0x100)?frame.f.constants:frame.reg;
	return keysource[R&0xff];
}

function LFunction(vm, chunk, env)
{
	var F = function () {};
	F.prototype = chunk;
	var o = new F();
	o.vm = vm;
	o.environment = env;
	o.chunk = chunk;
	o.upvalues = [];
	return o;
}

function LVM()
{
	this.callstack = [];
	this.stack = [];
	this.OPS = 0;
	this.cputime = 0;
	return this;
}

LVM.prototype = {
	LValue: function (value)
	{
		switch(typeof(value))
		{
		case "number":
			return new LValue(this, "number", value);
		case "boolean":
			return new LValue(this, "boolean", value != 0);
		case "string":
			return new LValue(this, "string", value);
		case "function":
			return new LValue(this, "function", value);
		case "object":
			if(value == null)
				return new LValue(this, "nil", value);
			else {
			  if (value.length > 0) {
				sys.debug&&sys.debug("(verify) adapting js array (0 -> 1)");
				var ml = value.length;
				for (var i=ml;i>0;i--) { 
				  value[i.toString()] = value[i-1];
				}
				delete value[0];
			  }
			  return new LValue(this, "table", value);
			}
		case "undefined":
			return new LValue(this, "nil", null);
		default:
			throw "Not able to convert type " +
				typeof(value)+" from Javascript to Lua";
		}
	},
	call: function (func, args)
	{
		var f = func.precall();
		if(typeof(f) == "function")
		{
			return f.apply(this, args);
		}
		else if(f.instructions)
		{
		  var frame = {f:f,pc:0,entry:true};
		  if(args)
			frame.reg = args.slice(0);
		  else
			frame.reg = [];
		  this.callstack.push(frame);

		  if (this.callstack.length == 1 && frame.reg.length > 0) {
			logOP_VARG("(verify) OP_VARG top-level workaround..."+
					   frame.reg);
			this._arg = args;
			logOP_VARG("f.environment.value.arg..."+ 
					   (f.environment.value.arg||null)+"/"+this._arg.length);

			// note: make a copy, since this will re-index from 0-based to 1-based...
			frame.f.environment.setIndex(
			  this.LValue("arg"),
			  this.LValue(args.slice(0))
			);

			var ret = this.run(frame);
			this._arg = null;
			return ret;
		  }

		  for(var i=frame.reg.length;i<f.maxStackSize;i++)
			frame.reg[i] = this.LValue();
		  return this.run(frame);
		}
		else
			throw "Attempt to call invalid function object: "+f.toString();
	},
	run: function(frame)
	{
		var instruction;
		while(this.callstack.length>0)
		{
			instruction = frame.f.instructions[frame.pc++];
			if(debugMode)
			{
				sys.puts("PC: "+(frame.pc-1)+" OP: "+instruction[0]);
				for(var i = 0; i < frame.reg.length; i++)
				{
					var entry = frame.reg[i];
					if(entry && entry.type)
						sys.puts("\t"+i+":\t("+entry.type+") "+entry.toString());
					else
						sys.puts("\t"+i+": "+entry);
				}
			}
			this.OPS++;
			switch(INS_OPCODE(instruction))
			{
			case OP_MOVE:
				frame.reg[INS_A(instruction)] = frame.reg[INS_B(instruction)];
				break;
			case OP_LOADNIL:
				for(var i = INS_A(instruction);i<=INS_B(instruction);i++)
					frame.reg[i] = new LValue(this, "nil", null);
				break;
			case OP_LOADBOOL:
				frame.reg[INS_A(instruction)] = new LValue(this, "boolean", INS_B(instruction)!=0);
				if(INS_C(instruction)!=0)
					frame.pc++;
				break;
			case OP_GETUPVAL:
				var upvalue = frame.f.upvalues[INS_B(instruction)];
				frame.reg[INS_A(instruction)] = new LValue(this, upvalue.type, upvalue.value);
 				if (upvalue.metatable)
 				  frame.reg[INS_A(instruction)].metatable = upvalue.metatable;
				break;
			case OP_GETGLOBAL:
				var name = frame.f.constants[INS_Bx(instruction)];
				frame.reg[INS_A(instruction)] = frame.f.environment.index(name);
				break;
			case OP_SETUPVAL:
				var reg = frame.reg[INS_A(instruction)];
				var upvalue = frame.f.upvalues[INS_B(instruction)];
				upvalue.type = reg.type;
				upvalue.value = reg.value;
				upvalue.metatable = reg.metatable;
				break;
			case OP_SETGLOBAL:
				var name = frame.f.constants[INS_Bx(instruction)];
				frame.f.environment.setIndex(name, frame.reg[instruction[1]]);
				break;
			case OP_LOADK:
				var constant = frame.f.constants[INS_Bx(instruction)];
				if (constant.metatable) throw "OP_LOADK: FIXME: metatable support?";
				frame.reg[INS_A(instruction)] = new LValue(this, constant.type, constant.value);
				break;
			case OP_NEWTABLE:
				frame.reg[INS_A(instruction)] = new LValue(this, "table", []);
				break;
			case OP_GETTABLE:
				var C = INS_C(instruction);
				var value = frame.reg[INS_B(instruction)].index(RK(frame, C));
				frame.reg[INS_A(instruction)] = new LValue(this, value.type, value.value);
				if (value.metatable)
				  frame.reg[INS_A(instruction)].metatable = value.metatable;
				break;
			case OP_SETTABLE:
				var C = INS_C(instruction);
				var B = INS_B(instruction);
				frame.reg[INS_A(instruction)].setIndex(RK(frame, B), RK(frame, C));
				break;
			case OP_VARARG:
				var A = INS_A(instruction);
				var wanted = INS_B(instruction)-1;
				var prevframe = this.callstack[this.callstack.length-2];
				var base = frame.retAt+frame.f.numParameters;


				// FIXME: workaround for top-level varargs (main program)
				if (!prevframe && 
					frame.entry == true 
// 					&& this.callstack.length == 1 
// 					&& this._arg
				   ) {
				  logOP_VARG("(verify) OP_VARARG patching top-level main chunk"+ this._arg +"#"+frame.reg.length);
				  prevframe = { reg: this._arg || [] };
				  base = -1; 
				  frame.reg.length = A;
				}

				if (isNaN(base)) {
				  //logOP_VARG("(xxx)"+ sys.inspect(this.callstack[0].reg));
 				  base = prevframe.reg.length - 2;
				  logOP_VARG("(verify) wasNaN(base)... now:"+base);
				}

				var available = (prevframe.reg.length - base) - 1;


				if (prevframe.reg == this._arg)
				  logOP_VARG("(verify) OP_VARARGs patched..."+sys.inspect(
							   {A:A,wanted: wanted, available: available}))
				if(wanted < 0)
				  wanted = available;
				for(var i = 0; i<wanted; i++)
				{
					if(i<available)
						frame.reg[A+i] = prevframe.reg[base+i+1];
					else
						frame.reg[A+i] = new LValue(this, "nil", null);
				}
				break;
			case OP_TAILCALL:
				var f = frame.reg[INS_A(instruction)].precall();
				if(typeof(f) != "function") // Can't tail-call native functions
				{
					var A = INS_A(instruction), B = INS_B(instruction);
					var undefined, args;
					if(B != 1)
						args = frame.reg.slice(A+1, B==0?frame.reg.length:(A+B));
					else
						args = [];
					if(args.length > f.numParameters)
						args.length = f.numParameters;
					for(var i=args.length;i<f.maxStackSize;i++)
						args[i] = new LValue(this, "nil", null); // Patch frame for new function
					frame.f = f; frame.pc = 0; frame.reg = args;
					break;
				}
				// Fall through...
			case OP_CALL:
				var f = frame.reg[INS_A(instruction)].precall(); // return JS or LFunction
				var A = INS_A(instruction), B = INS_B(instruction), C = INS_C(instruction);
				var undefined;
				var args;
				if(B != 1)
					args = frame.reg.slice(A+1, B==0?frame.reg.length:(A+B));
				else
					args = [];
				if(B != 0)
					frame.reg.length = A+B;
				if(typeof(f) == "function")
				{
					// JS native function
					var ret = this.call(frame.reg[INS_A(instruction)], args);
					// Insert ret to reg starting at R(A), with C-1 limit
					var nresults = ret.length;
					var nexpected;
					if(C == 0)
					{
						nexpected = nresults;
						frame.reg = frame.reg.slice(0, A+nexpected);
					}
					else
						nexpected = C-1;
					for(var i = 0;;i++)
					{
						if(i < nresults)
							frame.reg[A+i] = ret[i];
						else if(i < nexpected)
							frame.reg[A+i] = new LValue(this, "nil", null);
						else
							break;
					}
				}
				else
				{
					if(args.length > f.numParameters)
						args.length = f.numParameters;
					for(var i=args.length;i<f.maxStackSize;i++)
						args[i] = new LValue(this, "nil", null);
					// Lua function
					frame = {f:f,pc:0,reg:args,
						retAt:INS_A(instruction),retCount:INS_C(instruction),
						entry:false};
					this.callstack.push(frame);
				}
				break;
			case OP_CLOSURE:
				var prototype_id = INS_Bx(instruction);
				var chunk = frame.f.chunk.prototypes[prototype_id];
				var f = new LFunction(this, chunk, frame.f.environment);
				frame.reg[INS_A(instruction)] = new LValue(this, "function", f);
				for(var i=0;i<chunk.numUpvalues;i++)
				{
					var upval_instruction = frame.f.instructions[frame.pc++];
					switch(INS_OPCODE(upval_instruction))
					{
					case OP_MOVE:
						f.upvalues[i] = frame.reg[INS_B(upval_instruction)];
						break;
					case OP_GETUPVAL:
						f.upvalues[i] = frame.f.upvalues[INS_B(upval_instruction)];
						break;
					default:
						throw "Invalid upvalue opcode following OP_CLOSURE";
					}
				}
				break;
			case OP_RETURN:
				var oldFrame = this.callstack.pop();
				frame = this.callstack[this.callstack.length-1];
				var rets;
				if(INS_B(instruction) == 0)
					rets = oldFrame.reg.slice(INS_A(instruction));
				else
					rets = oldFrame.reg.slice(INS_A(instruction),INS_A(instruction)+(INS_B(instruction)-1));
				if(!oldFrame.entry)
				{
					var i;
					for(i=0;(oldFrame.retCount == 0||i<(oldFrame.retCount-1))&&i<rets.length;i++)
						frame.reg[oldFrame.retAt+i] = rets[i];
					if(oldFrame.retAt+i<frame.reg.length)
						frame.reg.length = (oldFrame.retAt+i);
					if(i<oldFrame.retCount)
					{
						for(;i<oldFrame.retCount;i++)
							frame.reg[oldFrame.retAt+i] = new LValue(this, "nil", null);
					}
				}
				else
					return rets;
				break;
			case OP_CLOSE:
				// No-op, since we leave upvalue management to the GC
				break;
			case OP_SELF:
				var table = frame.reg[INS_B(instruction)];
				frame.reg[INS_A(instruction)+1] = table;
				var C = INS_C(instruction);
				frame.reg[INS_A(instruction)] = table.index(RK(frame, C));
				break;
			case OP_FORPREP:
				frame.pc+=(INS_sBx(instruction));
				var A = INS_A(instruction);
				
				// make a copy of initializer ('x' in lua: for i=x,0,-1)
				frame.reg[A] = new LValue(this, "number", frame.reg[A].value);

				frame.reg[A].value -= frame.reg[A+2].value;
// 				sys.puts(sys.inspect(["OP_FORPREP", frame.reg[A].value, frame.reg[A+2].value]));
				break;
			case OP_FORLOOP:
				var A = INS_A(instruction);
				var RA = frame.reg[A];
				RA.value += frame.reg[A+2].value;

				var contd = frame.reg[A+2].value > 0
				  ? RA.value <= frame.reg[A+1].value
				  : RA.value >= frame.reg[A+1].value;
				  
				//				sys.puts(sys.inspect(["OP_FORLOOP", RA.value, frame.reg[A+2].value, contd]));
				if(contd)
				  {
					frame.pc += INS_sBx(instruction);
					frame.reg[A+3] = new LValue(this, "number", RA.value);
				  }
				break;
			case OP_TFORLOOP:
				var A = INS_A(instruction);
				var C = INS_C(instruction);
				var RA = frame.reg[A]; // Iterator function
				var rets = this.call(RA, [frame.reg[A+1], frame.reg[A+2]]);
				frame.reg.length = A+3;
				for(var i = 0; i<C; i++)
					frame.reg[A+3+i] = rets[i];
				if(frame.reg[A+3].type != "nil")
					frame.reg[A+2] = frame.reg[A+3];
				else
					frame.pc++; // Skip JMP to start
				continue;
			case OP_TEST:
				var RA = frame.reg[INS_A(instruction)];
				var RA_bool = RA.type == "nil" || (RA.type == "boolean" && RA.value == false);
				if(RA_bool == (INS_C(instruction)!=0))
					frame.pc++;
				break;
			case OP_TESTSET:
				var RB = frame.reg[INS_B(instruction)];
				var RB_bool = RB.type == "nil" || (RB.type == "boolean" && RB.value == false);
				if(RB_bool == (INS_C(instruction)!=0))
					frame.pc++;
				else
					frame.reg[INS_A(instruction)] = RB;
				break;
			case OP_JMP:
				frame.pc+=INS_sBx(instruction);
				break;
			case OP_CONCAT:
				var A = INS_A(instruction);
				var B = INS_B(instruction);
				var C = INS_C(instruction);
				var values = [];
				for(var i = B; i<=C; i++) {
				  if (frame.reg[i].type == 'number' ||
					  frame.reg[i].type == 'string')
					values.push(frame.reg[i].value);
				  else
					throw "attempt to concatenate <"+frame.reg[i]+"> (a "+
					  frame.reg[i].type+" value)";
				}
				frame.reg[A] = new LValue(this, "string", values.join(''));
				break;
			case OP_ADD:
				var RB = RK(frame, INS_B(instruction));
				var RC = RK(frame, INS_C(instruction));
				frame.reg[INS_A(instruction)] = RB.add(RC);
				break;
			case OP_SUB:
				var RB = RK(frame, INS_B(instruction));
				var RC = RK(frame, INS_C(instruction));
				frame.reg[INS_A(instruction)] = new LValue(this, "number", RB.value - RC.value);
				break;
			case OP_MUL:
				var RB = RK(frame, INS_B(instruction));
				var RC = RK(frame, INS_C(instruction));
				frame.reg[INS_A(instruction)] = new LValue(this, "number", RB.value * RC.value);
				break;
			case OP_DIV:
				var RB = RK(frame, INS_B(instruction));
				var RC = RK(frame, INS_C(instruction));
				frame.reg[INS_A(instruction)] = new LValue(this, "number", RB.value / RC.value);
				break;
			case OP_MOD:
				var RB = RK(frame, INS_B(instruction));
				var RC = RK(frame, INS_C(instruction));
				frame.reg[INS_A(instruction)] = new LValue(this, "number", RB.value % RC.value);
				break;
			case OP_POW:
				var RB = RK(frame, INS_B(instruction));
				var RC = RK(frame, INS_C(instruction));
				frame.reg[INS_A(instruction)] = new LValue(this, "number", Math.pow(RB.value, RC.value));
				break;
			case OP_UNM:
				var RB = frame.reg[INS_B(instruction)];
				frame.reg[INS_A(instruction)] = new LValue(this, "number", -RB.value);
				break;
			case OP_NOT:
				var RB = frame.reg[INS_B(instruction)];
				frame.reg[INS_A(instruction)] = new LValue(this, "boolean", !RB.truth());
				break;
			case OP_LEN:
				var RB = frame.reg[INS_B(instruction)];
				frame.reg[INS_A(instruction)] = new LValue(this, "number", RB.len());
				break;
			case OP_EQ:
				var A = INS_A(instruction);
				var RB = RK(frame, INS_B(instruction));
				var RC = RK(frame, INS_C(instruction));
				if(RB.equals(RC) != (A!=0))
					frame.pc++;
				break;
			case OP_LT:
				var A = INS_A(instruction);
				var RB = RK(frame, INS_B(instruction));
				var RC = RK(frame, INS_C(instruction));
				if(RB.value < RC.value != (A!=0))
					frame.pc++;
				break;
			case OP_LE:
				var A = INS_A(instruction);
				var RB = RK(frame, INS_B(instruction));
				var RC = RK(frame, INS_C(instruction));
				if(RB.value <= RC.value != (A!=0))
					frame.pc++;
				break;
			case OP_SETLIST:
				var A = INS_A(instruction);
				var RA = frame.reg[A];
				var B = INS_B(instruction);
				var C = INS_C(instruction);
				if(C == 0)
					throw "Dynamic table construction not yet implemented";
				// #define LFIELDS_PER_FLUSH 50 // Lua 5.1
				var baseindex = (C-1)*50;
				var index = new LValue(this, "number", 1);
				var lim = B>0?B:((frame.reg.length-baseindex)-2);
				for(var i = 1; i<=lim; index.value=(baseindex+(++i)))
					RA.setIndex(index, frame.reg[A+i]);
				break;
			default:
				throw "Unhandled opcode: "+INS_OPCODE(instruction);
			}
		}
	},
	registerLib: function (env, name, lib)
	{
		var t;
		if(name)
		{
			t = this.LValue([]); // Create env[name] and put fns in there
			env.setIndex(this.LValue(name), t);
		}
		else
			t = env; // Import directly into env
		
		for(var k in lib)
			t.setIndex(this.LValue(k), this.LValue(lib[k]));
		return t;
	},
	loadstring: function (chunk, env)
	{
		var c = new LBinaryChunk(this, chunk);
		var f = new LFunction(this, c, env);
		return new LValue(this, "function", f);
	},
	traceback: function ()
	{
		var trace = [];
		for(var i=this.callstack.length-1; i>=0; i--)
		{
			var currframe = this.callstack[i];
			var currfunc = currframe.f;
			var sourceName = (currfunc.sourceName||"=?").substr(1);
			var line = "?";
			if(currfunc.sourceLines && currfunc.sourceLines[currframe.pc-1])
				line = currfunc.sourceLines[currframe.pc-1];
			trace.push({ sourceName: sourceName, line: line });
		}
		return trace;
	}
};

// TODO: keep refactoring...
function openlibs(testvm) {
  var _G = testvm.LValue([]);

  // Standard library

  var baselib = {
	error: function (message)
	{
	  throw message.toString();
	},
	print: function ()
	{
	  if (arguments.length > 0) {
		var args = Array.prototype.slice.call(arguments);
		sys.print(args[0].toString());
		for(var i = 1; i<args.length; i++)
		  sys.print("\t"+(args[i]||"undefined").toString());
	  }
	  sys.print("\n");
	  return [];
	},
	setmetatable: function (table, metatable)
	{
	  if(arguments.length!=2)
		throw "setmetatable expects 2 arguments, got "+arguments.length;

	  table.setMetatable(metatable);
	  return [table];
	},
	getmetatable: function(table)
	{
	  return table.type == 'table' ? [table.getMetatable()] : [];
	},
	type: function (o)
	{
	  return [this.LValue(o.type)];
	},
	tostring: function(o)
	{
	  return [this.LValue(o.toString())];
	},
	tonumber: function(o)
	{
	  var v = parseFloat(o.value);
	  if (isNaN(v))
		v = null;
	  //sys.puts("tonumber("+o.value+"/"+o.type+") == "+v+typeof(v));
	  return [this.LValue(v)];
	},
	assert: function (expr, message)
	{
	  if(!expr || !expr.truth())
		if(message && message.truth())
		  throw message;
		else
		  throw "assertion failed";
	  return [expr];
	},
	pairs: function(t)
	{
	  var curr = 0;
	  var matches = [];
	  if (t.type != 'table') 
		throw "(fixme: match lua error description) pairs  called on non-table: "+t.type;
	  
	  for (var p in t.value) {
		matches.push(p);
		matches.push(t.value[p]);
	  }
	  var iter = function ()
	  {
		return [this.LValue(matches[curr++]),matches[curr++]];
	  };
	  return [this.LValue(iter)];
	}
	  
  };

  var math = {
	ldexp: function (m, e)
	{
	  return [this.LValue(m.value*Math.pow(2, e.value))];
	},
	frexp: function(x) {
	  var em = require('./misc/frexp').frexp(x.value);
	  //sys.debug(sys.inspect(["frexp(x)=",em.exponent,em.mantissa]));
	  return [this.LValue(em.mantissa),this.LValue(em.exponent)];
	  },
	floor: function (x)
	{
		return [this.LValue(Math.floor(x.value))];
	},
	sqrt: function (x)
	{
		return [this.LValue(Math.sqrt(x.value))];
	},
	random: function ()
	{
	  if(arguments.length!=0)
		throw "math.random arguments not implemented";

		return [this.LValue(Math.random())];
	},
	abs: function(x)
	{
	  return [this.LValue(Math.abs(x.value))];
	}
  };

  var _patternClasses = {
	"a": "[A-Za-z]", "A": "[^A-Za-z]",
	"p": "[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]",
	"P": "[^\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]",
	"s": "[\x09-\x0d\x20]", "S": "[^\x09-\x0d\x20]",
	"u": "[A-Z]", "U": "[^A-Z]",
	"d": "[0-9]", "D": "[^0-9]",
	"w": "[0-9A-Za-z]", "W": "[^0-9A-Za-z]",
	"x": "[0-9A-Fa-f]", "X": "[^0-9A-Fa-f]",
	"z": "[\x00]", "Z": "[^\x00]",
	"l": "[a-z]", "L": "[^a-z]",
	"c": "[\x00-\x1f\x7f]", "C": "[^\x00-\x1f\x7f]"
  };

  var _patternToRegExp = function (patt)
	{

	  // TODO: generically escape js-regexp tokens freestanding in lua-patterns
	  //       below only supports single-char examples seen from Yueliang -t
	  if (patt.length == 1 && /[\[+*?()\\/]/.test(patt)) {
		patt = "\\"+patt;
		//sys.puts("(verify) single-char pattern escaped: "+patt);
		return new RegExp(patt,"g");
	  }
				
	  var regexp = "";

	  // not all js supports string indexing...
	  if (patt.length && patt[0] === undefined)
		patt = patt.match(/[\s\S]/g);

	  for(var i=0;i<patt.length;i++)
		{
		  var c = patt[i];
		  if(c == "%")
			{
			  c = patt[++i];
			  if(c == "b")
				{
				  throw "%b not supported in patterns";
				}
			  else if(c >= "0" && c <= "9")
				{
				  regexp += ("\\"+c);
				  continue;
				}
			  else
				{
				  var cls = _patternClasses[c];
				  if(cls)
					{
					  regexp += cls;
					  continue;
					}
				}
			}
		  else if(c == "\\" || c == "/")
			regexp += "\\"; // Escape escapes
		  regexp += c;
		}
	  var old = regexp;
	  if (patt[0] == '[' && patt.indexOf('%') > 0 ) {// FIXME: only handles "[_%a]" but not ".+[_%a]" !!!!
		regexp = "["+regexp.substring(1,regexp.length-1).replace(/[\[\]]/g,'')+"]";
		//sys.debug&&sys.debug(patt+" :: "+regexp+" (was '"+old+"')")
	  }
	  return new RegExp(regexp, "g");
	};

  var string = {
	len: function(s) { return [this.LValue(s.len())]; },
	byte: function(s) { 
	  if (s.type != 'string' && s.type != 'number')
		throw "bad argument #1 to 'byte' (string expected, got "+s.type+")";

	  var nArgs = arguments.length;
	  if(nArgs != 1)
		throw "ljs.string.byte(): only implemented single-char version...."+nArgs;
	  return [this.LValue(s.value.charCodeAt(0))];
	},
	"char": function ()
	{
	  var nArgs = arguments.length;
	  if(nArgs < 1)
		throw "string.char(): Expects at least 1 parameter";
	  var results = "";
	  for(var i=0; i<nArgs; i++)
		{
		  var code = arguments[i];
		  if(code.type != "number")
			throw "string.char(): Argument #"+(i+1)+" expected number, got "+code.type;
		  results = results + String.fromCharCode(code.value);
		}
	  return [this.LValue(results)];
	},
	find: function (str, patt, init, plain)
	{
	  if (str.type != 'string')
		throw "bad argument #1 to 'find' (string expected, got "+str.type+")";

	  var isplain = plain && plain.truth();
	  var tstr = str.value;

// 	  if(arguments.length > 2)
// 		throw "string.find(): No more than the first 2 arguments supported"+arguments.length;
	  
	  var offset = (init && init.type == 'number' ? init.value : 1) -1;
 	  if (offset > 1) {
		tstr = tstr.substring(offset);
		// 		sys.puts(sys.inspect(["offseted string.find", tstr]));
 	  }
		
	  var ret;
	  if (isplain) {
		re = new RegExp(patt.value.replace(/([\S\s])/g,'\\$1'), "g");
		//sys.puts("(verify) string.find... plain mode!"+re);
	  } else {
		re = _patternToRegExp(patt.value);
	  }
	  var result = re.exec(tstr);
	  if(!result) {
		//		sys.puts(sys.inspect(["string.find", str.value, patt.value, ""+re, start, end]))
		return [this.LValue(null)];
	  }
	  var start = result.index+1 + offset;
	  var end = start + result[0].length - 1;
	  var ret = [this.LValue(start), this.LValue(end)];
	  //sys.puts(sys.inspect(["string.find", patt.value, ""+re, start, end]))
	  for(var i=1; i<result.length; i++)
		ret.push(this.LValue(result[i]));
	  return ret;
	},
	format: function (format_)
	{
	  var format = format_.value, result = "";
	  var re = new RegExp("%([0-9. ]*)([a-zA-Z%])", "g");
	  var match, currpos = 0, currparam = 1;
	  while(match = re.exec(format))
		{
		  result += format.substring(currpos, match.index);
		  currpos = re.lastIndex;
		  switch(match[2])
			{
			case "f": case "d":
			  if(match[1].length>0)
				throw "string.format(): Number format modifers not yet implemented";
			case "s":
			  result+=arguments[currparam++].value.toString();
			case "%":
			  break;
			default:
			  throw "string.format(): Format %"+match[2]+" not implemented";
			}
		}
	  result += format.substring(currpos);
	  return [this.LValue(result)];
	},
	gmatch: function (str, patt)
	{
	  var re = _patternToRegExp(patt.value);
	  var matches = str.value.match(re)||[];
	  var curr = 0;
	  var iter = function ()
	  {
		return [this.LValue(matches[curr++])];
	  };
	  return [this.LValue(iter)];
	},
	sub: function (str, from, to)
	{
	  var result;
	  switch(arguments.length)
		{
		case 0:
		case 1:
		  throw "string.sub(): Expected 2 or more arguments";
		case 2:
		  result = str.value.substring(
			from.value < 0 ? str.value.length + from.value : from.value-1);
		  //sys.puts(sys.inspect(["string.sub",str.value,from.value,result]))
		  break
		case 3:
		  result = str.value.substring(
			from.value < 0 ? str.value.length + from.value : from.value-1,
			to.value < 0 ? str.value.length + to.value + 1 : to.value);
		  //sys.puts(sys.inspect(["string.sub",str.value,from.value,to.value,result,result.length]));
		  break
		}
	  //	  sys.debug(sys.inspect(["string.sub", str, from, to, result]))
	  return [this.LValue(result)];
	},
	rep: function(str, n) {
	  var ret = "";
	  for (var i=0; i < n.value ;i++)
		ret += str;
	  return [this.LValue(ret)];
	},
	lower: function(s) {
	  s = s || { type:'no value' };
	  if (s.type != 'string' && s.type != 'number')
		throw "bad argument #1 to 'lower' (string expected, got "+s.type+")";
	  return [this.LValue(s.toString().toLowerCase())]
	}
  };

  // -----------------------------------------
  /* experimental module/require support */

  var modlog = sys.debug || function(){};//sys.puts
  var modlogV = sys.debug || function(){};//sys.puts
  // yeah, javascript "with"... ;)
  with(testvm.registerLib(_G, "package", { 
	seeall: "seeall",
	loaded: [],
	preload: []
  })) { // cache the final lvalues
	_G._packageloaded = index(testvm.LValue("loaded"));
	_G._packagepreload = index(testvm.LValue("preload"));
  };
  
  baselib.module = function(name, opt) {
	modlog("emulating module('"+name+"', "+opt+")");
	if (0) { // should be fixed now in OP_VARARG.. ?
	  // FIXME: OP_VARARG (...) doesnt seem to work in main chunks
	  //    but... the right data does seems to be there farther upstack
	  if (name.type == 'nil' && this.callstack.length >= 2) {
		var vargs = this.callstack[this.callstack.length-2].reg;
		var dotdotdotseeall = this.callstack[this.callstack.length-1].reg;
		if (dotdotdotseeall.length > 0) {
		  opt = dotdotdotseeall[dotdotdotseeall.length-1];
		  modlogV("(verify) found module(..., XYZ), XYZ="+opt);
		}
		name = vargs[vargs.length-1];
		opt = vargs[vargs.length]||opt;
		modlogV("(verify) emulated module(...): module('"+name+"', "+opt+")");
	  }
	}

	if (!name || name.type != 'string') 
	  throw "bad argument #1 to 'module' (string expected, got "+
		(name?name.type:"no")+" value)"; 

	// VERIFY: is this OK way to fetch _M via upstackvalue?
	var _M = this.callstack[this.callstack.length-1].f.environment;
	if (!_M._module_name)
	  throw "lvm.js ... internal error retrieving _M above";

 	if (!opt || opt.value != "seeall") {
	  modlog("resetting _M environment (!seeall)..."+name);
	  // nuke everything except for _M from global environment...
 	  for (var p in _M.value) {
		if (p != "_M") {
		  delete _M.value[p];
		}
 	  }
	}

	modlog("resetting module name..."+name);
	_M._module_name = name

	return [];
  };

  baselib.require = function (name) {
	var _M = _G._packageloaded.index(name);
	if (_M.type != 'nil')
	  return [_M];

	var f = _G._packagepreload.index(name);
	modlog("package.preload["+name+"] == "+f+"\n");
	if (f.type != 'nil') {
	  _M = this.LValue([]);
	  testvm.registerLib(_M, null, baselib);
	  for (var p in _G.value) {
		//sys.puts("_G."+p+" -> _M."+p);
		p = this.LValue(p);
		_M.setIndex(p, _G.index(p));
	  }
	  _M.setIndex(this.LValue("_M"), _M);

	  _M._module_name = name; // internal flag

	  //	  f.environment = _M;

	  // FIXME: passing second parameter of _M not to spec
	  // but not sure how to get this to javascript _setpreload otherwise..
	  var loaded = this.call(f, [name,_M])[0] || this.LValue(null);

	  if (loaded) {
		// 		sys.print("_M now"+_M);
		// 		sys.print("loaaded:"+loaded);
		if (_M._module_name != name) 
		  modlogV("(verify) require'"+name+"'"+
				   ", but module'"+_M._module_name+"'");

		// http://www.lua.org/manual/5.1/manual.html#5.3
		if (loaded.type == 'nil') {
		  modlogV("(verify) no module return value, using package.loaded.");
		  loaded = _G._packageloaded.index(name);
		}
		if (loaded.type == 'nil') {
		  modlogV("(verify) no package.loaded, so setting to true...");
		  loaded = this.LValue(true);
		}
		modlog("package.loaded["+name+"] = "+loaded+"!\n");
		_G._packageloaded.setIndex(name, loaded);

		name = _M._module_name;

		modlog("_G["+name+"] = "+_M+"!\n");
		_G.setIndex(name, _M)

		_M.setIndex(this.LValue("_NAME"), name);
		//TODO: _M._PACKAGE?

		return [loaded];
	  }
	}
	throw "module '"+name+"' not found:\n"+
	      "\tno field package.preload['"+name+"']";
  };
  testvm._setpreload = function(name, loader) {
	var domod = this.LValue(function(name, M) {
							  return [loader.apply(M,[name.value,M])];
							});
	_G._packagepreload.setIndex(this.LValue(name), 
								domod);
  };
  // -----------------------------------------------------
	
  testvm.registerLib(_G, null, baselib);
  testvm.registerLib(_G, "math", math);
  testvm.registerLib(_G, "io", {
	open: function() { 
						 throw "io.open -- not available";
						 
					   } ,
	write: function() {
						 for (var i=0; i < arguments.length; i++)
						   sys.print(arguments[i].toString())
						 return [];
					   }
  });

  testvm.registerLib(_G, "table", {
	concat: function(t,s) {
						 if (t.type != 'table') throw "(fixme: match lua error description) table.concat not table:"+t.type;
						 if (!s || s.type != 'string') throw "(fixme: match lua error description) table.concat not string:"+(s&&s.type);
						 
						 var ret = [];
						 for (var p=1; p <= t.len(); p++) {
						   ret.push(t.value[p].value);
						 }
						 return [this.LValue(ret.join(s.value))];
					   }
  });
  testvm.registerLib(_G, "string", string);
  _G.setIndex(testvm.LValue("_G"), _G);
  _G.setIndex(testvm.LValue("_VERSION"), testvm.LValue(_VERSION));

  // Metatable on environment to print out nil global accesses
  var mt = testvm.LValue([]);
  mt.setIndex(
			  testvm.LValue("__index"),
			  testvm.LValue(function (t, k) { (sys.debug||sys.puts)("(debug) Access of nil global: "+k); })
			  );
  _G.setMetatable(mt);
  return _G;
}

// TODO: if/when this becomes a js module
// ... exports.LVM = LVM, etc.
// ...  move this to standalone file!
if (typeof process != 'undefined') { // node
  var fs=require("fs");
  //  process.stdout.setEncoding("binary"); // doesn't seem to influence sys.print!
  sys.print = function(stuff) { process.stdout.write(stuff, 'binary'); };
	
  try {
	var testvm = new LVM();
	var _G = openlibs(testvm);

	testvm.registerLib(_G, "os", {
	  exit: function(n) {
						   process.exit(n&&n.value);
						 }
	});
	// FIXME: there's a better way
	_G.value.io.setIndex(
	  testvm.LValue("open"),
	  testvm.LValue(
		function(x) {
		  //sys.puts("io.open"+x)
		  // FIXME: insecure, should formally sandbox even for testing
		  if (x.type != "string" || !/^tests\/pass\//.test(x.value))
			throw "io.open dummy imp -- unexpected: "+x;
		  var ret = this.LValue([]);
		  ret.setIndex(this.LValue("read"),
					   this.LValue(
						 function(self,a) {
						   if (self != ret) 
							 throw "convoluted closure not working";
						   if (a.value != "*all")
							 throw "io.open.read dummy imp... unexpected: "+a.value;
						   var lua = fs.readFileSync(x.value, "binary");
						   sys.debug("io.open.read.*all "+x.value+"=="+lua.length);
						   return [this.LValue(lua)];
						 }));
		  return [ret];
		})
	);

	// ----------------------------------------------------------------------
	// TODO: could automatically compile .lua to bytecode for node version...
	var _loadmodule = function(nm, M) {
	  sys.debug("_loadmodule..."+nm+M);
	  var m = testvm.loadstring(fs.readFileSync(nm+".out", 
												"binary"), M);
	  return m.call([testvm.LValue(nm)])[0];
	}
	testvm._setpreload("testmodule", _loadmodule);
	testvm._setpreload("testmodule2", _loadmodule);
	// -----------------------------------

	var f = testvm.loadstring(fs.readFileSync("luac.out", "binary"), _G);

	//	debugMode = true;
	var arg = [];
	for (var i=2; /* +2 bc [0] is process name [1] is script name*/
		 i < process.argv.length; i++)
	  arg.push(testvm.LValue(process.argv[i]));
	
	var ret = testvm.call(f, arg);
	if(ret)
	  sys.debug("Returned: "+sys.inspect(ret));

  } catch(e) {
	var trace = testvm.traceback();
	var currframe = trace[0];
	if(currframe)
	  {
		sys.puts("lua(ljs): "+currframe.sourceName+":"+currframe.line+": "+e);
	  } else
	  sys.puts(e);
	if(typeof(e) == "object" && "stack" in e)
	  sys.puts(e.stack);
	else if (trace.length > 0) {
	  var lines = [];
	  try {
		lines = (fs.readFileSync(trace[0].sourceName, "binary")).split(/\n/);
	  } catch(e) { 
		sys.debug("ljs.node: was going to inspect lua source, but:" +e);
	  }
	  sys.puts("stack traceback:");
	  trace[trace.length-1].context = "in main chunk";
	  for (var i=0; i < trace.length; i++) {
		if (lines.length) {
		  // naive function name deduction...
		  trace[i].actualSourceLine = lines[trace[i].line-1];
		  if (!trace[i].context) {
			for (var l=0; l < 100 && trace[i].line-1-l >= 0; l++) {
			  var upline = lines[trace[i].line-1-l];
			  var arr = upline.match(
				/function ([\w:]+)?/
			  ) || upline.match(/([\w:]+)\s*=\s*function/);
			  if (arr) {
				trace[i].context = "perhaps in function '"+(arr[1]||arr[2])+"'";
				break;
			  }
			}
		  }
		}
		sys.puts("\t"+trace[i].sourceName+":"+trace[i].line+": "+(trace[i].context||"<todo>"));

		if (i == 0 || trace[i].actualSourceLine && process.argv[2] == '-v')
		  sys.debug("(sourceline)\t"+trace[i].actualSourceLine);
	  }
	}
	process.exit(1);
  }
 }
