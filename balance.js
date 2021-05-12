

var left = new Set()
var right = new Set()
var match = {};

function addDelimiter(left_deli, right_deli)
{
    left.add(left_deli)
    right.add(right_deli)
    match[left_deli] = right_deli
}

addDelimiter("(", ")")
addDelimiter("[", "]")
addDelimiter("{", "}")
addDelimiter("<", ">")


function check(line)
{
    stack = []

    for (c of line)
    {
        if (left.has(c))
            stack.push(c);

        else if (right.has(c))
        {
            if (stack.length == 0)
                return false;

            var top = stack.pop();
            if ( match[top] != c)
            {
                return false;
            }
        }
    }
    if (stack.length > 0)
        return false;
    else 
        return true;
}

var tests = 
{ 
    "<(>" : false,
    "<()>" : true, 
    "<123456>" : true, 
    "<1>" : true, 
    "<(>" : false, 
    "[[{[}" : false, 
    "2+3" : true, 
    "(1+2)" : true, 
    "((2-3)" : false, 
    "(2-3))" : false, 
    "((((" : false, 
    "))))" : false, 
    "{(1+2)-[1-3]}" : true, 
    "({)}" : false, 
    "([{}])" : true, 
    "([{])" : false
}

var n_passed = 0;
var n_total = 0;
for ([test_case,expected_result] of Object.entries(tests))
{
    ++n_total;
    var res = check(test_case);
    var cond = "PASSED"
    
    if (res != expected_result)
        cond = "FAILED"
    else
        n_passed++

    console.log( `check of ${test_case} returned ${res} ${cond}`);
}

console.log("====================================")
console.log("Total Test Cases: %d, PASSED: %d, FAILED: %d", n_total, n_passed, n_total-n_passed )




