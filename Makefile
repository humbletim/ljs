
all:
	@echo make test

# sanity check to make sure these run in stock lua
pretest:
	@echo "---  running tests/pass/*.lua through lua ---"
	@sh -c 'for x in tests/pass/*.lua ; \
	   do lua $$x >/dev/null || exit; done \
	   && echo lua tests/pass/\*.lua ran OK'

# run node-based test framework
test: pretest
	bash tests/run.sh
