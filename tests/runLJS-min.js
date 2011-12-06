// Copyright (c) 2011 Tim Dedischew 
// Copyright (c) 2010 Matthew Wild 

var sys = require("sys");
var fs=require("fs");

var LVM = require("../LJS-min").LVM;
var make_G = require("../LJS-min").make_G;
var luaopen_bytecode51 = require('../LJS-min').luaopen_bytecode51;
var luaopen_module51 = require('../LJS-min').luaopen_module51;

sys.print = function(stuff) { process.stdout.write(stuff, 'binary'); };

try {
  var testvm = new LVM();
  var _G = make_G(testvm);
  luaopen_module51(testvm, _G);
  luaopen_bytecode51(testvm, _G);
  var f = testvm.loadbytecode(fs.readFileSync("luac.out", "binary"), _G);

  var arg = [];
  for (var i=2; /* +2 bc [0] is process name [1] is script name*/
	   i < process.argv.length; i++)
	arg.push(testvm.LValue(process.argv[i]));
  
  if (arg.length == 0)
	_G.setIndex(testvm.LValue("arg"), testvm.LValue([]));

  var ret = testvm.call(f, arg);

  if(ret)
	sys.debug("Returned: "+sys.inspect(ret));

} catch(e) {
  var trace = testvm.traceback();
  var currframe = trace[0];
  if(currframe)
	sys.puts("lua(ljs): "+currframe.sourceName+":"+currframe.line+": "+e);
  else
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
	  sys.puts("\t"+trace[i].sourceName+":"+trace[i].line+": "
               +(trace[i].context||"<todo>"));

	  if (i == 0 || trace[i].actualSourceLine && process.argv[2] == '-v')
		sys.debug("(sourceline)\t"+trace[i].actualSourceLine);
	}
  }
  process.exit(1);
}
