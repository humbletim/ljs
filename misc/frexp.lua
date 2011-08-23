-- lua port of http://stackoverflow.com/questions/1552738/is-there-a-java-equivalent-of-frexp

function frexp(value) 
   local exponent = 0
   local mantissa = 0

   if (value == 0.0 or value == -0.0) then
	  -- good to go
   elseif value == math.huge then
	  mantissa = value;
	  exponent = -1;
   else
      mantissa = value;
      exponent = 0;
      local sign = 1;

      if (mantissa < 0) then
		 sign = sign - 1
		 mantissa = -(mantissa)
      end
	  
      while (mantissa < 0.5) do
		 mantissa = mantissa * 2.0
		 exponent = exponent - 1
      end
      while (mantissa >= 1.0) do
		 mantissa = mantissa * 0.5;
		 exponent = exponent + 1
      end
      mantissa = mantissa * sign
   end
   return exponent, mantissa
end
