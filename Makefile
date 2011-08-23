# TODO: makefile is too specific, need a good way to organize > 1 demos...

all: demo.html

demo.html: demo.lua.output.html \
	       	demo.luac.js demo.lua.src.html 
#                 testmodule.luac.js testmodule2.luac.js \
#	             testmodule.lua.src.html testmodule2.lua.src.html

demo.luac.js: demo.lua
	# $< = demo.lua, $@ = demo.luac.js
	luac -o $<c $<
	lua util/luac2js.lua $<c > $@

demo.lua.output.html: demo.lua
	( echo "<pre style='font-size:.9em'>" ; make -s lua-run ; \
	  echo "</pre>" ) > demo.lua.output.html 2>&1 || true

#demo.lua.numbered.html: demo.lua
#	nl -ba -nrz -w 3 -s "]] " $< |sed -e 's/^/--[[/'  | \
#	  perl util/lua2html.pl > $@

demo.lua.src.html: demo.lua
	  perl util/lua2html.pl $< > $@

# this approximates web browser test, using ndoe
node-run:
	luac -o testmodule.out testmodule.lua
	luac -o testmodule2.out testmodule2.lua
	luac -o luac.out demo.lua
	node lvm.js '(arg 1)' '(arg 2)'

node-run-quiet:
	@make -s node-run 2>/dev/null

run: node-run-quiet 

# this approximates web browser test, using lua
lua-run:
	env LUA_PATH=./?.lua lua demo.lua \
	  '(arg 1)' '(arg 2)'

lua-run-quiet:
	@make -s lua-run 2>/dev/null

# useful when dealing with subtleties
nodeeqlua:
	@bash -c 'A=$$(make node-run-quiet);B=$$(make lua-run-quiet);\
	    [ "$$A" == "$$B" ] && echo "node-run-quiet == lua-run-quiet" || ( \
	  (echo "----- node -----" ; make -s node-run-quiet ) > A.out.txt ; \
	  (echo "----- lua  -----" ; make -s lua-run-quiet ) > B.out.txt ; \
	  sdiff -l -w 80 B.out.txt A.out.txt ; \
	  rm A.out.txt B.out.txt ) '

# sanity check to make sure these run in stock lua
pretest:
	@echo "---  running tests/pass/*.lua through lua ---"
	@sh -c 'for x in tests/pass/*.lua ; \
	   do lua $$x >/dev/null || exit; done \
	   && echo lua tests/pass/\*.lua ran OK'

# run legacy node-based test framework
test: pretest
	bash tests/run.sh

clean:
	rm -vf demo.luac testmodule.luac testmodule2.luac
	rm -vf demo.luac.js testmodule.luac.js testmodule2.luac.js
	rm -vf demo.lua.output.html
	rm -vf demo.lua.src.html testmodule.lua.src.html testmodule2.lua.src.html
	rm -vf luac.out testmodule.out testmodule2.out

##### experimenting with yueliang...
testdump:
	( cd ../yueliang-0.4.1/orig-5.1.3 && \
		cat lopcodes.lua ldump.lua \
	 test/test_ldump.lua ) | sed -e 's/^dofile/--dofile/g' > testdump.lua

modluac: misc/yluac.lua
	( ( cd ../yueliang-0.4.1/orig-5.1.3 && \
	cat lzio.lua llex.lua lopcodes.lua ldump.lua lcode.lua lparser.lua ) ; \
	cat misc/yluac.lua ) | sed -e 's/^dofile/--dofile/g' > modluac.lua

##### experimenting with modules
testmodule.luac.js: testmodule.lua
	luac -o $<c $<
	lua util/luac2js.lua $<c > $@

testmodule2.luac.js: testmodule2.lua
	luac -o $<c $<
	lua util/luac2js.lua $<c > $@

testmodule.lua.src.html: testmodule.lua
	perl util/lua2html.pl $< > $@

testmodule2.lua.src.html: testmodule2.lua
	perl util/lua2html.pl $< > $@

