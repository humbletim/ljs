#!/bin/bash

failed="";
function failtest {
	echo "FAILED: $1";
	failed="$failed $1";
	failed_count=$(($failed_count+1))
}
test_count=0
failed_count=0

for script in tests/pass/*.lua; do
	luac "$script" && node lvm.js >/dev/null || failtest "$script";
	test_count=$(($test_count+1))
done

for script in tests/fail/*.lua; do
	luac "$script" && node lvm.js >/dev/null && failtest "$script";
	test_count=$(($test_count+1))
done

echo $(($test_count-$failed_count))"/$test_count TESTS PASSED";
if ! [ "$failed" == "" ]; then
	echo "$failed_count TESTS FAILED:";
	echo "$failed";
	exit 1;
fi
exit 0;
