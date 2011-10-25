/*
copyright(c) 2011 tim dedischew
released under MIT license
experimental "ffi" for ljs
only handles pattern 'function <name>(<args>){<body>}' and primitive return values

-- example:
  local ffi = require'ffi'
  ffi.jsdef[[ 
    function alert(x) { window.alert(x); }
    function escape(x) { return escape(x); }
    function plusone(x) { return x+1; }
  ]]
  ffi.js.alert[[ 'hi' from "lua" !!! ]]
  print("escaped 'a b!'", ffi.js.escape("'a b !'"))
  print("1+1", ffi.js.plusone(1))

*/
init_jsffi=function(testvm, _G) {
  jsffi = testvm.registerLib(_G, "ffi", {
	os: typeof process == 'object' ? 'node' : typeof window == 'object' ? 'browser' : 'other',
	jsdef: function(jscode)
	{
	  var codes = jscode.toString().split('function');
	  for (var i=0; i < codes.length; i++) {
		var code = codes[i];	  /*console.warn("jsdef:"+code);*/
		code.replace(
		  /\s+([_a-zA-Z$][_a-zA-Z0-9$]+)\s*\(([^\)]*)\)\s*\{([\s\S]*?)\}/,
		  function(_, name, args, body) {
			var def = {};
			jsffi._jsdefs = jsffi._jsdefs || {};
			jsffi._jsdefs[name] = def;
			args = args.replace(/\s+/g,'');
			def.args = args;
			def.body = body;
			def.jseval = "1,function("+args+"){"+body+"}";
			try {
			  def.func = eval(def.jseval);
			} catch(e) {
			  console.error(e,def.jseval);
			}
			/*console.warn(name, args, body);*/
		  });
	  }
	  return [];
	},
	js: []
  });
  _G._package_loaded.setIndex(testvm.LValue("ffi"), jsffi);
  var mt = testvm.LValue([]);
  mt.setIndex(
	testvm.LValue("__index"),
	testvm.LValue(function (t, k) {
					var jsdef = jsffi._jsdefs[k.toString()];
					if (!jsffi) {
					  throw "Access of undefined jsdef: ffi.js."+k;
					}
					/*console.warn("ffi.js", k+'', jsdef);*/
					return [testvm.LValue(function() {
											var args=[];
											for (var i=0;i < arguments.length;i++)
											  args[i]=arguments[i].value;
											var ret = jsdef.func.apply(jsdef.func, args);
											return ret ? [testvm.LValue(ret)] : [];
										  })];
				  })
  );
  jsffi.index(testvm.LValue("js")).setMetatable(mt);
};

if (typeof exports == 'object') 
  exports.init_jsffi = init_jsffi;
