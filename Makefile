all: release

release: LJS.js

LJS.js: src/ljs.sys.js src/ljs.lvm.js src/ljs.baselib.js src/ljs.bytecode.js src/ljs.module51.js
	cat $^ > $@

LJS-min.js: LJS.js
	java -jar compiler.jar --js $< > $@

clean:
	rm -vf LJS.js LJS-min.js luac.out

# sanity check to make sure these run in stock lua
pretest:
	@echo "---  running tests/pass/*.lua through lua ---"
	@sh -c 'for x in tests/pass/*.lua ; \
	   do lua $$x >/dev/null || exit; done \
	   && echo lua tests/pass/\*.lua ran OK'

# run node-based test framework
test: pretest
	bash tests/run.sh
