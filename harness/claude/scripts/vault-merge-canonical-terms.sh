#!/usr/bin/env bash
# Fold canonical terms into other canonical terms.
# Usage: vault-merge-canonical-terms.sh <agg-dir>
#   <agg-dir>/merge.tsv : <canonical to remove>\t<canonical to keep>
# Rewrites assign.tsv (token-exact substitution in column 2) and canon.tsv
# (removes the folded row, appends its name + aliases to the kept row's aliases).
set -euo pipefail

AGG="${1:?usage: vault-merge-canonical-terms.sh <agg-dir>}"

perl -e '
my ($aggdir) = @ARGV;
my %m;
open my $mf, "<", "$aggdir/merge.tsv" or die $!;
while (<$mf>) { chomp; my ($from, $to) = split /\t/; $m{$from} = $to if $from }
close $mf;

# canon.tsv: fold aliases of removed rows into the kept rows
open my $cf, "<", "$aggdir/canon.tsv" or die $!;
my (@order, %cat, %alias);
while (<$cf>) { chomp; my ($n, $c, $a) = split /\t/; push @order, $n; $cat{$n} = $c; $alias{$n} = $a }
close $cf;
for my $from (grep { exists $m{$_} } @order) {
  my $to = $m{$from};
  die "merge target missing from canon.tsv: $to\n" unless exists $cat{$to};
  my @add = ($from);
  push @add, split /\|/, $alias{$from} unless $alias{$from} eq "-";
  my %seen = map { $_ => 1 } ($alias{$to} eq "-" ? () : split /\|/, $alias{$to});
  my @keep = ($alias{$to} eq "-" ? () : split /\|/, $alias{$to});
  for my $a (@add) { next if $seen{$a}++; push @keep, $a }
  $alias{$to} = join "|", @keep;
}
open my $co, ">", "$aggdir/canon.tsv" or die $!;
for my $n (@order) { next if exists $m{$n}; print $co join("\t", $n, $cat{$n}, $alias{$n} || "-"), "\n" }
close $co;

# assign.tsv: rewrite canonical tokens
open my $af, "<", "$aggdir/assign.tsv" or die $!;
my @lines;
while (<$af>) {
  chomp;
  my ($raw, $val) = split /\t/, $_, 2;
  unless ($val =~ /^DROP:/) {
    my (@out, %seen);
    for my $t (split /;/, $val) { $t = $m{$t} // $t; push @out, $t unless $seen{$t}++ }
    $val = join ";", @out;
  }
  push @lines, "$raw\t$val";
}
close $af;
open my $ao, ">", "$aggdir/assign.tsv" or die $!;
print $ao "$_\n" for @lines;
close $ao;
' "$AGG"

echo "merged $(wc -l < "$AGG/merge.tsv") terms; canon.tsv now $(wc -l < "$AGG/canon.tsv") rows"
