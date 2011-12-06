/** @license 
ljs - Lua VM in JavaScript
ljs.sys.js - require('sys') stubs
Copyright (c) 2011 Tim Dedischew
MIT license
*/

// TODO: more cleanup; prefer console.warn over sys.puts
(function(exports) {
  if (typeof require == 'undefined' || !require('sys')) {
	if (typeof WScript == 'object') {
	  console={log:function(a,b,c,d) { WScript.Echo(a,b,c,d);}};
	  console.warn=console.log;
	}

	var clog = typeof console == 'object' && console.log;
  
	var stubs = {
	  sys: {
		_printbuf: "",
		_outputline: function(s) {
		  if (!clog) return;
		  if (console.log == stubs.sys.puts) throw "console.log == stubs.sys.puts";
		  console.log("sys._outputline: "+s);
		},
		puts: function() { stubs.sys.print(Array.prototype.slice.call(arguments)+"\n"); },
		//debug: function(s) { stubs.sys.puts("DEBUG: "+s); },
		print: function(s) { 
		  // emulate node(?) sys.print behaviour for lvm.js
		  if (/\n/.test(s)) {
			stubs.sys._outputline(stubs.sys._printbuf+s);
			stubs.sys._printbuf = "";
		  } else
			stubs.sys._printbuf += s;
		},
		inspect: function(s) {
		  return s+'';
		}
	  }
	};

	exports.require = function(it) {
	  return (stubs)[it];
	};

	exports.console=exports.console || {
	  warn:function(s){ stubs.sys.puts('(warn)'+s); },
	  log:stubs.sys.puts
	};
  } else
	exports.require = require;
  return exports;
})(typeof exports == 'object' ? exports : typeof window == 'object' ? window : {} );
