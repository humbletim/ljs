#!/bin/bash

set -e

failed="";
function failtest {
    # allow aggressive control-c to interrupt entire test run
	# (control-c will cause failtest to be called...)
	# (control-c on sleep will exit script)
	sleep .25
	echo "[FAILED] $1";
	failed="$failed $1";
	failed_count=$(($failed_count+1))
}
test_count=0
failed_count=0
echo "---------------------------------------------"
echo "  tests/pass/*.lua"
for script in tests/pass/*.lua; do
	( luac "$script" && 
		node lvm.js 2>&1 && 
		echo "  [  OK  ] $script" >>/dev/stderr
	) > /dev/null || failtest "$script";
	test_count=$(($test_count+1))
done
echo "  -- tested $test_count .lua's"

echo "---------------------------------------------"
echo "  tests/fail/*.lua (nada == pass)"
st=$test_count
for script in tests/fail/*.lua; do
	luac "$script" && node lvm.js >/dev/null 2>&1 && failtest "$script";
	test_count=$(($test_count+1))
done
echo "  -- tested $(($test_count - $st)) .lua's"

echo "---------------------------------------------"
echo $(($test_count-$failed_count))"/$test_count TESTS PASSED";
if ! [ "$failed" == "" ]; then
	echo "$failed_count TESTS FAILED:";
	echo "$failed";
	exit 1;
fi
echo ""
exit 0;
