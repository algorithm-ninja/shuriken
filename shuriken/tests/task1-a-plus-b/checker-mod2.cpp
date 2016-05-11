#include <cstdio>

int main(int argc, char* argv[]) {
  int sum;
  fscanf(fopen(argv[1], "r"), "%d", &sum);
  return sum % 2;
}
