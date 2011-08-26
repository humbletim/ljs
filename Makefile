# TODO: makefile is too specific, need a good way to organize > 1 demos...

all: demo.html

demo.html: demo.lua.output.html \
	       	demo.luac.js demo.lua.src.html \
	                testmodule.luac.js \
		            testmodule.lua.src.html 
#			yueliang.luac.js

%.luac: %.lua
	luac -o $@ $<

%.luac.js: %.luac
	lua util/luac2js.lua $< > $@

%.lua.src.html: %.lua
	  perl util/lua2html.pl $< > $@

demo.lua.output.html: demo.lua
	( echo "<pre style='font-size:.9em'>" ; make -s lua-run ; \
	  echo "</pre>" ) > demo.lua.output.html 2>&1 || true

#demo.lua.numbered.html: demo.lua
#	nl -ba -nrz -w 3 -s "]] " $< |sed -e 's/^/--[[/'  | \
#	  perl util/lua2html.pl > $@


# this approximates web browser test, using ndoe
node-run: testmodule.luac
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

# run node-based test framework
test: pretest
	bash tests/run.sh

clean:
	rm -vf *.luac *.luac.js 
	rm -vf demo.lua.output.html
	rm -vf demo.lua.src.html testmodule.lua.src.html 
	rm -vf luac.out _yueliang.lua _modluac.lua

##### experimenting with yueliang...
#testdump:
#	( cd ../yueliang-0.4.1/orig-5.1.3 && \
#		cat lopcodes.lua ldump.lua \
#	 test/test_ldump.lua ) | sed -e 's/^dofile/--dofile/g' > testdump.lua

yueliang.luac: _yueliang.lua
	@echo "making stripped $@"
	luac -s -o $@ $<

yueliang.luac.js: yueliang.luac
	lua util/luac2js.lua $< > $@

_yueliang.lua: misc/mluac.lua misc/frexp.lua
	( echo '-- composited yueliang.lua @ ' `date -u` ; \
	  echo 'module(..., package.seeall)' ; \
	   ( cd ../yueliang-0.4.1/orig-5.1.3 && \
        cat lzio.lua llex.lua lopcodes.lua ldump.lua lcode.lua lparser.lua \
       ) ; \
	  cat misc/frexp.lua misc/yueliang_patch.lua misc/mluac.lua \
    ) | sed -e 's/^dofile/--dofile/g' > _yueliang.lua

_modluac.lua: misc/yluac.lua misc/yueliang_patch.lua
	( \
	  ( cd ../yueliang-0.4.1/orig-5.1.3 && \
		cat lzio.lua llex.lua lopcodes.lua ldump.lua lcode.lua lparser.lua \
	  ) ; \
	  cat misc/yueliang_patch.lua misc/yluac.lua \
	) | sed -e 's/^dofile/--dofile/g' > _modluac.lua

modluac: _modluac.lua
	luac _modluac.lua
	@echo "luac.out is now yueliang-compiler"

# TODO: yueliang needs separate test script, but for now...
ytest: modluac
	bash -c 'set -e ; for x in tests/pass/*.lua tests/fail/*.lua ; do \
		  node lvm.js $$x 2>/dev/null > $$x.yluac && echo "[ compiled (ljs) ] $$x!" || ( echo "FAIL(compile): $$x" && cat $$x.yluac && rm $$x.yluac ) ; \
		   [ -e $$x.yluac ] && ( ( lua $$x.yluac 2>/dev/null >/dev/null \
	         && echo "[ ran (`which lua`) ] $$x.yluac" ) || echo "FAIL(`which lua`): $$x" && rm $$x.yluac ) ; \
	done'

