#!/usr/bin/perl

# From: Mike Pall <mikelu-0603@...>
# Date: Thu, 23 Mar 2006 13:52:53 +0100
# http://lua-users.org/lists/lua-l/2006-03/msg00661.html

#-- Minimal infrastructure, copied from NoNameWiki.
%SaveUrl = ();
$SaveUrlIndex = 0;
$FS = "\x01";

sub QuoteHtml {
  my ($html) = @_;
  $html =~ s/$FS//go;
  $html =~ s/&/&amp;/g; $html =~ s/</&lt;/g; $html =~ s/>/&gt;/g;
  return $html;
}

sub StoreRaw {
  my ($html) = @_;
  $SaveUrl{$SaveUrlIndex} = $html;
  return $FS . $SaveUrlIndex++ . $FS;
}

#-- Functions for Lua 5.1 syntax highlighting:
sub StoreSpan {
  my ($text, $cl) = @_;
  return &StoreRaw("<span class=\"$cl\">$text</span>");
}

sub StoreLuaSyntax {
  my ($code) = @_;
  $code =~ s/((--)?\[(=*)\[.*?\]\3\])|((['"])(\\.|.)*?\5)|(--[^\n]*)/&StoreSpan($&, ($2 or $7)?"comment":"string")/gseo;
  $code =~ s/\b(and|break|do|else|elseif|end|false|for|function|if|in|local|nil|not|or|repeat|return|then|true|until|while)\b/&StoreSpan($1, "keyword")/geo;
  $code =~ s/(?<!\.)\b((string|table|math|coroutine|io|os|package|debug)(\s*\.\s*\w+)?)\b/&StoreSpan($1, "library")/geo;
  $code =~ s/(?<!\.)\b(assert|collectgarbage|dofile|error|gcinfo|getfenv|getmetatable|ipairs|loadfile|load|loadstring|module|next|newproxy|pairs|pcall|print|rawequal|rawget|rawset|require|select|setfenv|setmetatable|tonumber|tostring|type|unpack|xpcall|_G)\b/&StoreSpan($1, "library")/geo;
  return &StoreRaw("<pre class=\"code\">\n$code</pre>\n");
}

#-- Main program:
local $/;
local $txt = &QuoteHtml(<>);

# For Wiki &CommonMarkup: s/{{{!Lua\n(.*?\n)}}}/&StoreLuaSyntax($1)/gse;
$txt = &StoreLuaSyntax($txt);

$txt =~ s/$FS(\d+)$FS/$SaveUrl{$1}/geo;
$txt =~ s/$FS(\d+)$FS/$SaveUrl{$1}/geo;

print <<EOF
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/
DTD/xhtml11.dtd">
<html>
<style type="text/css">
background { background: #ffffff; color: #000000; }
pre.code {
  font-size: 10pt;
  font-family: Courier New, Courier, monospace;
  /* Uncomment this for the Wiki stylesheet:
  background: #f8f8f8;
  color: #000000;
  border: 1px solid black;
  padding: 0.5em;
  margin-left: 2em;
  */
}
span.comment { color: #00a000; }
span.string { color: #0000c0; }
span.keyword { color: #a00000; font-weight: bold; }
span.library { color: #a000a0; }
</style>
<body>
$txt
</body>
</html>
EOF
