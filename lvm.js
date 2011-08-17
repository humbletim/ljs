
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
		else
			throw "Attempt to call a " + this.type + " value";
	},
	index: function (key, raw)
	{
		if(this.type == "table")
		{
			var val;
			if(key.value in this.value)
				return this.value[key.value];
			else if(raw != true && this.metatable && this.metatable.type != "nil")
			{
				var __index = this.metatable.index(this.vm.LValue("__index"));
				if(__index.type == "function")
				{
					return this.vm.LValue(__index.call([this, key])[0]);
				}
				else if(__index.type != "nil")
					return __index.index(key);
			}
			return this.vm.LValue(null);
		}
		else
			throw "Attempt to index a " + this.type + " value";
	},
	setIndex: function (key, value)
	{
		if(this.type == "table")
		{
			this.value[key.value] = value;
		}
		else
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
	toString: function ()
	{
		switch(this.type)
		{
		case "nil":
			return "nil";
		default:
			return this.value.toString();
		}
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
		case "table":
			return this.value.length;
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
	return this;
}

LVM.prototype = {
	LValue: function (value)
	{
		switch(typeof(value))
		{
		case "number":
			return new LValue(this, "number", value);
		case "string":
			return new LValue(this, "string", value);
		case "function":
			return new LValue(this, "function", value);
		case "object":
			if(value == null)
				return new LValue(this, "nil", value);
			else
				return new LValue(this, "table", value);
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
			for(var i=frame.reg.length;i<f.maxStackSize;i++)
				frame.reg[i] = this.LValue(null);
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
				break;
			case OP_SETGLOBAL:
				var name = frame.f.constants[INS_Bx(instruction)];
				frame.f.environment.setIndex(name, frame.reg[instruction[1]]);
				break;
			case OP_LOADK:
				var constant = frame.f.constants[INS_Bx(instruction)];
				frame.reg[INS_A(instruction)] = new LValue(this, constant.type, constant.value);
				break;
			case OP_NEWTABLE:
				frame.reg[INS_A(instruction)] = new LValue(this, "table", []);
				break;
			case OP_GETTABLE:
				var C = INS_C(instruction);
				var value = frame.reg[INS_B(instruction)].index(RK(frame, C));
				frame.reg[INS_A(instruction)] = new LValue(this, value.type, value.value);
				break;
			case OP_SETTABLE:
				var C = INS_C(instruction);
				var B = INS_B(instruction);
				frame.reg[INS_A(instruction)].setIndex(RK(frame, B), RK(frame, C));
				break;
			case OP_VARARG:
				var A = INS_A(instruction);
				var prevframe = this.callstack[this.callstack.length-2];
				var base = frame.retAt+frame.f.numParameters;
				var available = (prevframe.reg.length - base) - 1;
				var wanted = INS_B(instruction)-1;
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
						args = frame.reg.slice(A+1, B==0?undefined:(A+B));
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
					args = frame.reg.slice(A+1, B==0?undefined:(A+B));
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
				frame.reg[A].value -= frame.reg[A+2].value;
				break;
			case OP_FORLOOP:
				var A = INS_A(instruction);
				var RA = frame.reg[A];
				RA.value += frame.reg[A+2].value;
				if(RA.value <= frame.reg[A+1].value)
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
				for(var i = B; i<=C; i++)
					values.push(frame.reg[i].value);
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
			var currframe = testvm.callstack[i];
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

try{
var testvm = new LVM();

var fs=require("fs");
var sys=require("sys");

var _G = testvm.LValue([]);

// Standard library

var baselib = {
	error: function (message)
	{
		throw message.toString();
	},
	print: function ()
	{
		var args = Array.prototype.slice.call(arguments);
		sys.print(args[0].toString());
		for(var i = 1; i<args.length; i++)
			sys.print("\t"+args[i].toString());
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
	type: function (o)
	{
		return [this.LValue(o.type)];
	},
	assert: function (expr, message)
	{
		if(!expr.truth())
			if(message && message.truth())
				throw message;
			else
				throw "assertion failed";
		return [expr];
	}
};

var math = {
	ldexp: function (m, e)
	{
		return [this.LValue(m.value*Math.pow(2, e.value))];
	},
	floor: function (x)
	{
		return [this.LValue(Math.floor(x.value))];
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
	"c": "[\x00-\x1f\x7f]", "C": "[^\x00-\x1f\x7f]",
};

var _patternToRegExp = function (patt)
{
	var regexp = "";
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
	return new RegExp(regexp, "g");
};

var string = {
	"char": function ()
	{
		var nArgs = arguments.length;
		if(nArgs < 1)
			throw "string.char(): Expects at least 1 parameter";
		var results = [];
		for(var i=0; i<nArgs; i++)
		{
			var code = arguments[i];
			if(code.type != "number")
				throw "string.char(): Argument #"+(i+1)+" expected number, got "+code.type;
			results.push(String.fromCharCode(code.value));
		}
		return [this.LValue(results.join(''))];
	},
	find: function (str, patt, init, plain)
	{
		if(arguments.length > 2)
			throw "string.find(): No more than the first 2 arguments supported";
		var re = _patternToRegExp(patt.value);
		var result = re.exec(str);
		if(!result)
			return [this.LValue(null)];
		var start = result.index+1;
		var end = start + result[0].length - 1;
		var ret = [this.LValue(start), this.LValue(end)];
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
			result = str.value.substring(from.value);
		case 3:
			result = str.value.substring(from.value, to.value);
		}
		return [this.LValue(result)];
	}
};
testvm.registerLib(_G, null, baselib);
testvm.registerLib(_G, "math", math);
testvm.registerLib(_G, "string", string);

// Metatable on environment to print out nil global accesses
var mt = testvm.LValue([]);
mt.setIndex(
	testvm.LValue("__index"),
	testvm.LValue(function (t, k) { sys.puts("Access of nil global: "+k); })
);
_G.setMetatable(mt);


var f = testvm.loadstring(fs.readFileSync("luac.out", "binary"), _G);

var ret = testvm.call(f);
if(ret)
	sys.puts("Returned: "+sys.inspect(ret));

}
catch(e)
{
	var trace = testvm.traceback();
	var currframe = trace[0];
	if(currframe)
	{
		sys.print("lvm.js: "+currframe.sourceName+":"+currframe.line+": ");
	}
	sys.puts(e);
	if(typeof(e) == "object" && "stack" in e)
		sys.puts(e.stack);
	process.exit(1);
}
