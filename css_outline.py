def css_outline(num_points, radius, units, colour):
    from math import cos, sin, pi
    shadows = []
    for i in range(num_points):
        t = i * 2 * pi / num_points
        x = sin(t) * radius
        y = cos(t) * radius
        shadows.append("%.3f%s %.3f%s %s" % (x, units, y, units, colour))
    return (', '.join(shadows))

