/** @license
ljs - Lua VM in JavaScript
ljs.lvm.js - Lua VM and bytecode interpreter core
Copyright (c) 2011 Tim Dedischew
Copyright (c) 2010 Matthew Wild
MIT license
*/

(function(exports) { 

var _VERSION = "Lua 5.1  {ljs=0.00200}"

var sys=require("sys");
var debugMode = false;
var logOP_VARG = sys.debug || function() {};

function LValue(vm, type, value)
{
	this.vm = vm;
	this.type = type||"nil";
	this.value = value;
}

var _hasprop = function(thing, key) {
	return thing.hasOwnProperty(key);
};

if (typeof navigator == 'object' && /opera/i.test(navigator.userAgent)) {
  _hasprop = function(thing, key) {
	return key in thing;
  };
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

		if (0 > "string number nil boolean".indexOf(key.type))
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

		// number, nil, boolean -> string rep
		// see: updated len() implementation
		var kv = key.value.toString();

		// .hasOwnProperty so "concat" doesn't pick up javascript:[].concat
		if (_hasprop(this.value, kv)) {
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
		if ( !raw && this.metatable &&  !_hasprop(this.value, kv)) {
		  // key.type == 'boolean', 'nil', 'table', 'function'
		  // all possible if forwarding to metamethod...
		  if (0 > "string number".indexOf(key.type ))
			sys.debug("(info) __newindex["+key.type+"]");
		  var metamethod = this._getMeta("__newindex");
		  if (metamethod)
			return metamethod.call([this,key,value]);
		}
		// treat numbers as a string index (like js does)
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
	  if (this.type == "boolean") return this.truth().toString();

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
				// ... return result[0].truth()?
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
	this._VERSION = _VERSION;
	this._LValue = LValue;
	return this;
}

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
					   frame.reg.length);
			this._arg = args;
// 			logOP_VARG("f.environment.value.arg..."+ 
// 					   (f.environment.value.arg||null)+"/"+this._arg.length);

			// note: make a copy, since this will re-index from 0-based to 1-based...
			var arg = this.LValue(args.slice(0));
			var old = frame.f.environment;
			old.setIndex(
			  this.LValue("arg"),
			  arg
			);
			
// 			for(var i=frame.reg.length;i<f.maxStackSize;i++)
// 			  frame.reg[i] = this.LValue();

			var ret = this.run(frame);
			this._arg = null;
			if (old.value.arg == arg) {
			  delete old.value.arg;
			} else {
			  for (var p in old.value.arg) 
				sys.puts(p);
			  sys.puts(old.value.arg);
			  
			  for (var p in arg.value) 
				sys.puts(p+arg.value[p]);
			  throw ".call emulated vararg mismatch" + arg;
			}
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
				  logOP_VARG("(verify) OP_VARARG "+
							 "patching top-level main chunk"+ 
							 this._arg +"#"+frame.reg.length);
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
				if(frame.reg[A+3] && frame.reg[A+3].type != "nil")
					frame.reg[A+2] = frame.reg[A+3];
				else
					frame.pc++; // Skip JMP to start
				continue;
			case OP_TEST:
				var RA = frame.reg[INS_A(instruction)];
				var RA_bool = !RA.truth();//RA.type == "nil" || (RA.type == "boolean" && RA.value == false);
				if(RA_bool == (INS_C(instruction)!=0))
					frame.pc++;
				break;
			case OP_TESTSET:
				var RB = frame.reg[INS_B(instruction)];
				var RB_bool = !RB.truth();//RB.type == "nil" || (RB.type == "boolean" && RB.value == false);
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
				frame.reg[INS_A(instruction)] =
				  new LValue(this, "number", Math.pow(RB.value, RC.value));
				break;
			case OP_UNM:
				var RB = frame.reg[INS_B(instruction)];
				if (RB.type != 'number')
				  throw "attempt to perform arithmetic on ... "+
					"(a "+RB.type+" value)";
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
				if (RB.type == 'table' || RC.type == 'table')
				  throw "attempt to compare number with table";
				if(RB.value < RC.value != (A!=0))
					frame.pc++;
				break;
			case OP_LE:
				var A = INS_A(instruction);
				var RB = RK(frame, INS_B(instruction));
				var RC = RK(frame, INS_C(instruction));
				if (RB.type == 'table' || RC.type == 'table')
				  throw "attempt to compare number with table";
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
	loadchunk: function (c, env)
	{
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

exports.LVM = LVM; 
exports.LValue = LValue; 
exports.LFunction = LFunction; 
return exports; 

})(typeof exports == 'object' ? exports :
    typeof window == 'object' ? window :
    {} ); 
