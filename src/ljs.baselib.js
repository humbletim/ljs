/** @license
ljs - Lua VM in JavaScript
ljs.baselib.js - lua base library
Copyright (c) 2011 Tim Dedischew
Copyright (c) 2010 Matthew Wild
MIT license
*/

(function(exports) {

  // Standard library

  var sys = require('sys');
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
	  if (!o) throw "bad argument #1 to 'tostring' (value expected)";
	  return [this.LValue(o.toString())];
	},
	tonumber: function(o)
	{
	  if (!o) throw "bad argument #1 to 'tonumber' (value expected)";
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
	  t = t || { type:'no value' };

	  if (t.type != 'table')
		throw "bad argument #1 to 'pairs' (table expected, got "+t.type+")";
	  
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

	floor: function (x)
	{
		return [this.LValue(Math.floor(x.value))];
	},
	sqrt: function (x)
	{
		return [this.LValue(Math.sqrt(x.value))];
	},
	sin: function (x)
	{
	  return [this.LValue(Math.sin(x.value))];
	},
	cos: function (x)
	{
	  return [this.LValue(Math.cos(x.value))];
	},
	pi: Math.PI,
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
	  var original = patt;
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
	  if (patt[0] == '[' && original.indexOf('%') > 0 ) {// FIXME: only handles "[_%a]" but not ".+[_%a]" !!!!
		regexp = "["+regexp.substring(1,regexp.length-1).replace(/[\[\]]/g,'')+"]";
		//sys.debug&&sys.debug(patt+" :: "+regexp+" (was '"+old+"')")
	  }

	  return new RegExp(regexp, "g");
	};

  var string = {
	len: function(s) { return [this.LValue(s.len())]; },
	"byte": function(s) { 
	  if (s.type != 'string' && s.type != 'number')
		throw "bad argument #1 to 'byte' (string expected, got "+s.type+")";

	  var nArgs = arguments.length;
	  if(nArgs != 1)
		throw "ljs.string.byte(): only implemented single-char version...."+nArgs;
	  return [this.LValue(s.toString().charCodeAt(0))];
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

	  if (patt.type != 'number' && patt.type != 'string')
		throw "bad argument #2 to 'find' (string expected, got "+patt.type+")";

	  var isplain = plain && plain.truth();
	  var tstr = str.value;

// 	  if(arguments.length > 2)
// 		throw "string.find(): No more than the first 2 arguments supported"+arguments.length;
	  
	  var offset = (init && init.type == 'number' ? init.value : 1) -1;
 	  if (offset > 1) {
		tstr = tstr.substring(offset);
		// 		sys.puts(sys.inspect(["offseted string.find", tstr]));
 	  }
		
	  var re;
	  if (isplain) {
		var start = tstr.indexOf(patt.value);
		if (start < 0)
		  return [this.LValue(null)];
		
		return [this.LValue(start+1+offset),
				this.LValue(start+patt.value.length+offset)];
// 		re = new RegExp(patt.value.replace(/([\S\s])/g,'[$1]'), "g");
// 		sys.puts("(verify) string.find... plain mode!"+re+"/"+tstr);
// 		sys.debug(sys.inspect(re.exec(tstr)));
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

  // TODO: keep refactoring...
  function openlibs(testvm, _G) {
	_G = _G || testvm.LValue([]);
	
  testvm.registerLib(_G, null, baselib);
  testvm.registerLib(_G, "math", math);
  testvm.registerLib(_G, "io", {
	open: function() { throw "io.open -- not available"; },
	write: function() {
						 for (var i=0; i < arguments.length; i++)
						   sys.print(arguments[i].toString());
						 return [];
					   }
  });

  testvm.registerLib(_G, "table", {
	concat: function(t,s)
	{
	  if (t.type != 'table')
		throw "bad argument #1 to 'concat' (table expected, got "+t.type+")";
	  if (!s || s.type == 'nil')
		s=this.LValue("");
	  if (s.type != 'string' && s.type != 'number')
		throw "bad argument #2 to 'concat' (string expected, got "+s.type+")";
	  var ret = [];
	  for (var p=1; p <= t.len(); p++) {
		ret.push(t.value[p].value);
	  }
	  return [this.LValue(ret.join(s.toString()))];
	}
  });
  testvm.registerLib(_G, "string", string);
	return _G;
  }

  function make_G(testvm) {
	var _G = openlibs(testvm);
  _G.setIndex(testvm.LValue("_G"), _G);
	_G.setIndex(testvm.LValue("_VERSION"), testvm.LValue(testvm._VERSION));

  // Metatable on environment to print out nil global accesses
  var mt = testvm.LValue([]);
  mt.setIndex(
			  testvm.LValue("__index"),
			  testvm.LValue(function (t, k) { (sys.debug||sys.puts)("(debug) Access of nil global: "+k); })
			  );
  _G.setMetatable(mt);
  return _G;
  };
  //  exports.openlibs = openlibs;
  exports.make_G = make_G;
  return exports;
})(typeof exports == 'object' ? exports : typeof window == 'object' ? window : {} );

