#include <random>

std::random_device rd;
std::mt19937 rng(rd());
std::uniform_int_distribution<int> uni(0, 1);

int main() {
  return uni(rng);
}
