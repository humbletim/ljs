// license (CC BY-SA 3.0) http://stackoverflow.com/faq#editing
// js port of http://stackoverflow.com/questions/1552738/is-there-a-java-equivalent-of-frexp/1562857#1562857
// original author: http://stackoverflow.com/users/122428/jitter
// ported to js by http://github.com/humbletim/ljs

(function(exports) { 
  // -- using stubs, to keep code as similiar as possible to original
  var test = { frexp: frexp };
  var System = { out: { println: function(x) { console.info(x); } } };
  var Double = {
	isNaN: isNaN,
	isInfinite: function(x) { return x == Infinity || x == -Infinity; }
  };
  // --

  
  function frexp (value) {
	var ret = {};
  
	ret.exponent = 0;
	ret.mantissa = 0;

	if (value == 0.0 || value == -0.0) {
	  return ret;
	}

	if (Double.isNaN(value)) {
	  ret.mantissa = Double.NaN;
	  ret.exponent = -1;
	  return ret;
	}

	if (Double.isInfinite(value)) {
	  ret.mantissa = value;
	  ret.exponent = -1;
	  return ret;
	}

	ret.mantissa = value;
	ret.exponent = 0;
	var sign = 1;

	if (ret.mantissa < 0) {
	  sign--;
	  ret.mantissa = -(ret.mantissa);
	}
	while (ret.mantissa < 0.5) {
	  ret.mantissa *= 2.0;
	  ret.exponent -= 1;
	}
	while (ret.mantissa >= 1.0) {
	  ret.mantissa *= 0.5;
	  ret.exponent++;
	}
	ret.mantissa *= sign;
	return ret;
  }

  function test_frexp(x) {
	var value = arguments.length > 0 ? x : 8.0;
	//var value = 0.0;
	//var value = -0.0;
	//var value = Double.NaN;
	//var value = Double.NEGATIVE_INFINITY;
	//var value = Double.POSITIVE_INFINITY;

	var frexp = test.frexp(value);
	System.out.println("Mantissa: " + frexp.mantissa);
	System.out.println("Exponent: " + frexp.exponent);
	System.out.println("Original value was: " + value);
	System.out.println(frexp.mantissa+" * 2^" + frexp.exponent + " = ");
	System.out.println(frexp.mantissa*(1<<frexp.exponent));
  }
  
  // module glue
  exports.test_frexp = test_frexp;
  exports.frexp = frexp;
  return exports;
})(typeof exports == 'object' ? exports : window );
