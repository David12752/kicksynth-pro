#pragma once
#include <vector>

struct BezierNode {
    float x, y;
    float handleInX, handleInY;
    float handleOutX, handleOutY;
};

class BezierEnvelope {
public:
    void addNode(float x, float y);
    float getNextValue();
private:
    std::vector<BezierNode> nodes;
};
