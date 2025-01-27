const canvas = document.getElementById("cadCanvas");
const overlayCanvas = document.getElementById("overlayCanvas");
const ctx = canvas.getContext("2d");

let file;

let shapes = [];
let actionStack = [];
let redoStack = [];

let mode = "";
let currentLineStyle = "default";

let crosshairPosition = null; // Tracks the cursor position for the crosshair

let isDrawing = false;
let isFreehandDrawing = false;
let isMoving = false;
let isRotating = false;

let lastFreehandX = 0;
let lastFreehandY = 0;
let currentFreehandShape = null; // Track the current freehand shape

let panX = 0;
let panY = 0;
let isPanning = false;
let lastMouseX = 0;
let lastMouseY = 0;

let startX, startY;
let moveOffsetX = 0, moveOffsetY = 0;

// Initial zoom scale
let scale = 1;
const minScale = 1; // Minimum zoom level
const maxScale = 5; // Maximum zoom level

let selectedShape = null;
let selectedRotateShape = null;
let backgroundImg = null; 

setfile1();

function setMode(selectedMode) {
  mode = selectedMode;

  // Show arc inputs only when 'arc' mode is selected
  const arcInputs = document.getElementById("arcInputs");

  if (selectedMode === "arc") {
    arcInputs.style.display = "flex";
  } 
  else if(selectedMode === "draw") {
    arcInputs.style.display = "none";
    isFreehandDrawing = true;
  } 
  else if(selectedMode === "rotate") {
    arcInputs.style.display = "none";
    isRotating = true;
  } 
  else {
      arcInputs.style.display = "none";
  }

  updateCursor();
}

function updateCursor() {
	if (mode === "text") {
	  canvas.style.cursor = "text"; 
	} 
  else if (
    mode === "line" ||
    mode === "arrowOne" ||
    mode === "arrowDouble" ||
    mode === "circle" ||
    mode === "arc" ||
    mode === "rectangle"
  ) {
    canvas.style.cursor = "none"; // Hide the default cursor for drawing modes
  }
  else if (mode === "move") {
	  canvas.style.cursor = "move"; 
	} 
  else if (mode === "erase" || mode === "draw") {
	  canvas.style.cursor = "crosshair"; 
	} 
  else if(mode === "rotate") {
    canvas.style.cursor = `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 214.367 214.367"><path d="M202.403,95.22c0,46.312-33.237,85.002-77.109,93.484v25.663l-69.76-40l69.76-40v23.494 c27.176-7.87,47.109-32.964,47.109-62.642c0-35.962-29.258-65.22-65.22-65.22s-65.22,29.258-65.22,65.22 c0,9.686,2.068,19.001,6.148,27.688l-27.154,12.754c-5.968-12.707-8.994-26.313-8.994-40.441C11.964,42.716,54.68,0,107.184,0 S202.403,42.716,202.403,95.22z"/></svg>'), auto`;
  }
  else {
	  canvas.style.cursor = "default"; // Default cursor for other modes
	}
}

function applyLineStyle(style) {
  if (style === "thin") {
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
  } else if (style === "dashed") {
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
  } else if (style === "thin-dashed") {
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
  } else if (style === "center") {
    ctx.lineWidth = 1;
    ctx.setLineDash([15, 5, 5, 5]);
  } else {
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
  }
}

function setLineStyle(style) {
  currentLineStyle = style;
}

function setfile1() {
  // Create an input element dynamically
  const input = document.createElement('input');
  input.type = 'file';

  // Use fetch to get the image as a blob
  fetch('Template.png')
    .then(response => response.blob()) // Convert response to Blob
    .then(blob => {
      // Create a File object to mimic user upload behavior
      const file = new File([blob], 'Template.png', { type: 'image/png' });

      // Manually trigger the change event with the file
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;

      // Call the existing setBackground function with the simulated input event
      setBackground({ target: input });
    })
    .catch(error => console.error('Error loading image:', error));
}

function setBackground(event) {
  file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        backgroundImg = img; // Store the loaded image in memory
        redrawCanvas(); // Redraw the canvas to include the background image
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function clearCanvas() {
  shapes = [];
  redoStack = [];
  backgroundImg = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      backgroundImg = img; // Store the loaded image in memory
      redrawCanvas(); // Redraw the canvas to include the background image
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function undo() {
  if (actionStack.length > 0) {
    const lastAction = actionStack.pop();

    if (lastAction.type === "add") {
      redoStack.push(lastAction);
      shapes.pop(); // Remove the last added shape
    } else if (lastAction.type === "erase") {
      redoStack.push(lastAction);
      shapes.push(lastAction.shape); // Restore the erased shape
    }

    redrawCanvas();
  }
}

function redo() {
  if (redoStack.length > 0) {
    const lastRedo = redoStack.pop();

    if (lastRedo.type === "add") {
      actionStack.push(lastRedo);
      shapes.push(lastRedo.shape);
    } else if (lastRedo.type === "erase") {
      actionStack.push(lastRedo);
      shapes = shapes.filter((shape) => shape !== lastRedo.shape); // Re-erase the shape
    }

    redrawCanvas();
  }
}

function isPointInsideShape(x, y, shape) {
  switch (shape.type) {
    case "rectangle":
      const tolerance1 = 5; // Tolerance value, adjust as necessary
    
      // Check if the click is on the left edge of the rectangle
      const onLeftEdge = Math.abs(x - shape.startX) <= tolerance1 && y >= shape.startY && y <= shape.startY + shape.height;
    
      // Check if the click is on the right edge of the rectangle
      const onRightEdge = Math.abs(x - (shape.startX + shape.width)) <= tolerance1 && y >= shape.startY && y <= shape.startY + shape.height;
    
      // Check if the click is on the top edge of the rectangle
      const onTopEdge = Math.abs(y - shape.startY) <= tolerance1 && x >= shape.startX && x <= shape.startX + shape.width;
    
      // Check if the click is on the bottom edge of the rectangle
      const onBottomEdge = Math.abs(y - (shape.startY + shape.height)) <= tolerance1 && x >= shape.startX && x <= shape.startX + shape.width;
    
      return onLeftEdge || onRightEdge || onTopEdge || onBottomEdge;
  }
}

function drawArrow(x1, y1, x2, y2, doubleArrow) {
  const arrowLength = 10 / scale; // Adjust arrowhead size based on zoom
  const angle = Math.atan2(y2 - y1, x2 - x1);

  const startX = x1 * scale;
  const startY = y1 * scale;
  const endX = x2 * scale;
  const endY = y2 * scale;

  // Main arrow line
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);

  // Calculate angles for the arrowheads
  const angle1 = angle - Math.PI / 6;
  const angle2 = angle + Math.PI / 6;

  // First arrowhead at the endpoint
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - arrowLength * Math.cos(angle1),
    endY - arrowLength * Math.sin(angle1)
  );

  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - arrowLength * Math.cos(angle2),
    endY - arrowLength * Math.sin(angle2)
  );

  // Second arrowhead at the start point for double arrow
  if (doubleArrow) {
    ctx.moveTo(startX, startY);
    ctx.lineTo(
      startX + arrowLength * Math.cos(angle1),
      startY + arrowLength * Math.sin(angle1)
    );

    ctx.moveTo(startX, startY);
    ctx.lineTo(
      startX + arrowLength * Math.cos(angle2),
      startY + arrowLength * Math.sin(angle2)
    );
  }

  ctx.stroke();
}



function isShapeHovered(shape, x, y) {
  switch (shape.type) {
    case "freedraw":
      // Loop through the points in the freehand shape
      for (let i = 0; i < shape.points.length - 1; i++) {
        const start = shape.points[i];
        const end = shape.points[i + 1];
        const distance = pointToSegmentDistance(x, y, start.x, start.y, end.x, end.y);

        if (distance <= 5) { // Adjust tolerance as needed
          return true;
        }
      }
      break;

    case "line":
    case "arrowOne":
    case "arrowDouble":
      const dx = shape.endX - shape.startX;
      const dy = shape.endY - shape.startY;
      const lengthSquared = dx * dx + dy * dy; // Avoids sqrt for performance

      // Check if the point (x, y) is close enough to the line segment
      const t = ((x - shape.startX) * dx + (y - shape.startY) * dy) / lengthSquared;
      
      // Allow a tolerance range (e.g., 5 pixels) for clicking near the line
      const tolerance = 5;
      if (t < 0 || t > 1) {
        return false;
      }

      // Calculate the closest point on the line segment
      const closestX = shape.startX + t * dx;
      const closestY = shape.startY + t * dy;

      // Check if the point (x, y) is within the tolerance range of the line
      const distance1 = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2);
      return distance1 <= tolerance;

    case "rectangle":
      const tolerance1 = 5; // Adjust this value based on your precision requirements
      // Use the isPointOnRotatedRectangleEdge function to determine if the click is on the rectangle's edge
      return isPointOnRotatedRectangleEdge(x, y, shape, tolerance1);

    case "circle":
      const distance = Math.sqrt((x - shape.startX) ** 2 + (y - shape.startY) ** 2);
      return distance <= shape.radius;

    case "arc": {
      const dx = x - shape.startX;
      const dy = y - shape.startY;
    
      // Calculate the distance from the point to the center of the arc
      const distanceFromCenter = Math.sqrt(dx ** 2 + dy ** 2);
    
      // Check if the distance is close to the arc's radius (within a tolerance)
      const tolerance = 5; // Adjust as needed
      if (Math.abs(distanceFromCenter - shape.radius) > tolerance) {
        return false; // The point is not near the circumference
      }
    
      // Calculate the angle of the point relative to the center of the arc
      let pointAngle = Math.atan2(dy, dx);
      if (pointAngle < 0) {
        pointAngle += 2 * Math.PI; // Normalize angle to [0, 2π]
      }
    
      // Check if the angle is within the arc's start and end angles
      const { startAngle, endAngle } = shape;
      if (startAngle <= endAngle) {
        return pointAngle >= startAngle && pointAngle <= endAngle;
      } else {
        // Handle cases where the arc spans past 0 radians (e.g., endAngle < startAngle)
        return pointAngle >= startAngle || pointAngle <= endAngle;
      }
    }

    case "gdandt":
      const centerX = shape.x + 60;  // Shift to center horizontally
      const centerY = shape.y + 20;  // Shift to center vertically

      return (
        x >= centerX - 120 / 2 && 
        x <= centerX + 120 / 2 &&  // Right edge
        y >= centerY - 40 / 2 && 
        y <= centerY + 40 / 2     // Top edge
      );

    case "sr":
      const centerS = shape.x;  // Shift to center horizontally
      const centerR = shape.y;  // Shift to center vertically

      return (
        x >= centerS - 60 / 2 && 
        x <= centerS + 60 / 2 &&  // Right edge
        y >= centerR - 20 / 2 && 
        y <= centerR + 20 / 2     // Top edge
      );  

    case "datum":
      return isHoveringOverDatum(x, y, shape);  

    case "circleDatum":
      // Scale the shape's position and radius
    const shapeX = shape.x;
    const shapeY = shape.y;
    const radius = 20 * scale; // Scaled radius of the circle

    // Calculate the distance between the mouse position and the circle's center
    const distanceC = Math.sqrt((x - shapeX) ** 2 + (y - shapeY) ** 2);

    // Return true if the distance is less than or equal to the circle's radius
    return distanceC <= radius; 

    case "bubble":
      // Scale the shape's position and radius
    const shapeA = shape.x;
    const shapeB = shape.y;
    const radiusA = 10 * scale; // Scaled radius of the circle

    // Calculate the distance between the mouse position and the circle's center
    const distanceA = Math.sqrt((x - shapeA) ** 2 + (y - shapeB) ** 2);

    // Return true if the distance is less than or equal to the circle's radius
    return distanceA <= radiusA; 

    case "text":
      // Check if the mouse is within the text bounding box
      const textWidth = ctx.measureText(shape.text).width + 10;
      const textHeight = parseInt(ctx.font, 10); // Assuming font is set, e.g., '20px Arial'
      
      // Transform text coordinates with pan and scale
      const transformedX = shape.startX;
      const transformedY = shape.startY;

      return (
        x >= transformedX &&
        x <= transformedX + textWidth &&
        y >= transformedY - textHeight - 10 &&
        y <= transformedY + textHeight  - 10
      );
  

    default:
      return false;
  }
}

function isHoveringOverDatum(x, y, shape) {
  const direction = shape.direction || 'up'; // Direction of the shape ('up', 'down', 'left', 'right')

  // Sizes
  const rectangleWidth = 25;
  const rectangleHeight = 30;
  const triangleHeight = 15;
  const triangleWidth = 20;
  const lineGap = 10;

  // Determine the rectangle and triangle positions based on the direction
  let rectX, rectY, triPoints;

  if (direction === 'up') {
    const rectTopY = shape.y - triangleHeight - lineGap - rectangleHeight;
    rectX = shape.x - rectangleWidth / 2;
    rectY = rectTopY;

    triPoints = [
      { x: shape.x, y: shape.y - triangleHeight }, // Top of triangle
      { x: shape.x - triangleWidth / 2, y: shape.y }, // Bottom-left
      { x: shape.x + triangleWidth / 2, y: shape.y }, // Bottom-right
    ];
  } else if (direction === 'down') {
    const rectTopY = shape.y + triangleHeight + lineGap;
    rectX = shape.x - rectangleWidth / 2;
    rectY = rectTopY;

    triPoints = [
      { x: shape.x, y: shape.y + triangleHeight }, // Bottom of triangle
      { x: shape.x - triangleWidth / 2, y: shape.y }, // Top-left
      { x: shape.x + triangleWidth / 2, y: shape.y }, // Top-right
    ];
  } else if (direction === 'left') {
    const rectLeftX = shape.x - triangleWidth - lineGap - rectangleWidth;
    rectX = rectLeftX;
    rectY = shape.y - rectangleHeight / 2;

    triPoints = [
      { x: shape.x - triangleWidth, y: shape.y }, // Left of triangle
      { x: shape.x, y: shape.y - triangleHeight / 2 }, // Top-right
      { x: shape.x, y: shape.y + triangleHeight / 2 }, // Bottom-right
    ];
  } else if (direction === 'right') {
    const rectLeftX = shape.x + triangleWidth + lineGap;
    rectX = rectLeftX;
    rectY = shape.y - rectangleHeight / 2;

    triPoints = [
      { x: shape.x + triangleWidth, y: shape.y }, // Right of triangle
      { x: shape.x, y: shape.y - triangleHeight / 2 }, // Top-left
      { x: shape.x, y: shape.y + triangleHeight / 2 }, // Bottom-left
    ];
  }

  // Hover detection for the rectangle
  const isHoveringRectangle = (
    x >= rectX &&
    x <= rectX + rectangleWidth &&
    y >= rectY &&
    y <= rectY + rectangleHeight
  );

  // Hover detection for the triangle (use barycentric coordinates for triangle detection)
  function isPointInTriangle(px, py, p1, p2, p3) {
    const area = 0.5 * (-p2.y * p3.x + p1.y * (-p2.x + p3.x) + p1.x * (p2.y - p3.y) + p2.x * p3.y);
    const s = 1 / (2 * area) * (p1.y * p3.x - p1.x * p3.y + (p3.y - p1.y) * px + (p1.x - p3.x) * py);
    const t = 1 / (2 * area) * (p1.x * p2.y - p1.y * p2.x + (p1.y - p2.y) * px + (p2.x - p1.x) * py);

    return s >= 0 && t >= 0 && 1 - s - t >= 0;
  }

  const isHoveringTriangle = isPointInTriangle(
    x,
    y,
    triPoints[0],
    triPoints[1],
    triPoints[2]
  );

  // Hover detection for the line (simplified as a rectangle for tolerance)
  const lineWidth = 2; // Line width for hover detection
  let isHoveringLine = false;

  if (direction === 'up' || direction === 'down') {
    const lineX = shape.x - lineWidth / 2;
    const lineTopY = direction === 'up' ? rectY + rectangleHeight : shape.y;
    const lineBottomY = direction === 'up' ? shape.y - triangleHeight : rectY;

    isHoveringLine = (
      x >= lineX &&
      x <= lineX + lineWidth &&
      y >= lineTopY &&
      y <= lineBottomY
    );
  } else if (direction === 'left' || direction === 'right') {
    const lineY = shape.y - lineWidth / 2;
    const lineLeftX = direction === 'left' ? rectX + rectangleWidth : shape.x;
    const lineRightX = direction === 'left' ? shape.x - triangleWidth : rectX;

    isHoveringLine = (
      y >= lineY &&
      y <= lineY + lineWidth &&
      x >= lineLeftX &&
      x <= lineRightX
    );
  }

  // Return true if hovering over any part of the shape
  return isHoveringRectangle || isHoveringTriangle || isHoveringLine;
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}


function addTextInput(mouseX, mouseY) {
  // Reverse transformations to get the actual canvas coordinates
  const canvasX = (mouseX - panX * scale) / scale;
  const canvasY = (mouseY - panY * scale) / scale;

  const input = document.createElement("input");
  input.type = "text";
  input.style.position = "absolute";
  input.style.left = `${mouseX + canvas.offsetLeft}px`;
  input.style.top = `${mouseY + canvas.offsetTop}px`;
  input.style.fontSize = `${16 * scale}px`; // Match scaling
  input.style.border = "1px solid #000";
  input.style.padding = "2px";

  document.body.appendChild(input);
  input.focus();

  // Save text on blur or enter and remove input
  input.addEventListener("blur", () => {
      //drawTextOnCanvas(canvasX, canvasY, input.value); // Use transformed coordinates
      document.body.removeChild(input);
  });

  input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
          drawTextOnCanvas(canvasX, canvasY, input.value); // Use transformed coordinates
          document.body.removeChild(input);
      }
  });
}

  
function drawTextOnCanvas(x, y, text) {
  if (!text.trim()) return; // Avoid empty text

  // Add the text to the shapes array
  shapes.push({
      type: "text",
      startX: x, // Canvas coordinates
      startY: y,
      text,
      rotation: 0,
      style: { color: "black" } // Add styling as needed
  });

  // Redraw the canvas
  redrawCanvas();
}


  function redrawCanvas(hoveredShape = null) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply panning transform
    ctx.save();
    ctx.translate(panX * scale, panY * scale);

    // Draw the background image
    if (backgroundImg) {
      // Calculate scaling factor to fill the canvas
      const imgAspectRatio = backgroundImg.width / backgroundImg.height;
      const canvasAspectRatio = canvas.width / canvas.height;

      let drawWidth, drawHeight;

      if (imgAspectRatio > canvasAspectRatio) {
          // Image is wider than canvas
          drawHeight = canvas.height * scale; // Match canvas height
          drawWidth = drawHeight * imgAspectRatio; // Scale width proportionally
      } else {
          // Image is taller than canvas
          drawWidth = canvas.width * scale; // Match canvas width
          drawHeight = drawWidth / imgAspectRatio; // Scale height proportionally
      }

      ctx.drawImage(
          backgroundImg ,
          0, // Center horizontally
          0, // Center vertically
          drawWidth, // Final width
          drawHeight // Final height
      );
    }
    // Apply zoom directly when drawing
    shapes.forEach((shape) => {
      // Scale shapes according to the zoom level
      const scaledStartX = shape.startX * scale;
      const scaledStartY = shape.startY * scale;
      const scaledEndX = shape.endX * scale;
      const scaledEndY = shape.endY * scale;
      const scaledWidth = shape.width * scale;
      const scaledHeight = shape.height * scale;
      const scaledRadius = shape.radius * scale;
  
      applyLineStyle(shape.style);
      ctx.beginPath();
  
      switch (shape.type) {
        case "line":
          ctx.moveTo(scaledStartX, scaledStartY);
          ctx.lineTo(scaledEndX, scaledEndY);
          if (hoveredShape === shape) {
            ctx.strokeStyle = "rgba(0, 0, 0, 1)"; // Change color for hover
            ctx.lineWidth += 1; // Highlight with thicker stroke
          }
          ctx.stroke();
          break;

        case "freedraw":
          ctx.beginPath();
          for (let i = 0; i < shape.points.length - 1; i++) {
            const start = shape.points[i];
            const end = shape.points[i + 1];
            ctx.moveTo(start.x * scale, start.y * scale);
            ctx.lineTo(end.x * scale, end.y * scale);
          }
          ctx.stroke();
          break;  
  
          case "rectangle": 
          if (shape.rotation !== 0) { 
              if(hoveredShape === shape) {
                ctx.fillStyle = "rgba(0, 0, 0, 0.1)"; // Highlight the rectangle
                drawRotatedRect(scaledStartX, scaledStartY, scaledWidth, scaledHeight, shape.rotation, true);
              } else {
                ctx.fillStyle = "rgba(0, 0, 0, 0.1)"; // Highlight the rectangle
                drawRotatedRect(scaledStartX, scaledStartY, scaledWidth, scaledHeight, shape.rotation, false);
              }
    
          } else {
            if (hoveredShape === shape) {
              ctx.fillStyle = "rgba(0, 0, 0, 0.1)"; // Highlight the rectangle
              ctx.fillRect(scaledStartX, scaledStartY, scaledWidth, scaledHeight);
            }
            ctx.strokeRect(scaledStartX, scaledStartY, scaledWidth, scaledHeight);
          }
          break; 
  
        case "circle":
          ctx.arc(scaledStartX, scaledStartY, scaledRadius, 0, 2 * Math.PI);
          ctx.stroke();
          if(hoveredShape === shape) {
            ctx.save();
            drawCenterCross(scaledStartX, scaledStartY, scaledRadius);
            ctx.restore();
          }
          break;
  
        case "arc":
          ctx.arc(scaledStartX, scaledStartY, scaledRadius, shape.startAngle, shape.endAngle);
          ctx.stroke();
          if(hoveredShape === shape) {
            ctx.save();
            drawCenterCross(scaledStartX, scaledStartY, scaledRadius);
            ctx.lineWidth = 1; // Reset to default thickness
            //ctx.restore();
          }
          break;
  
        case "arrowOne":
        case "arrowDouble":
          if (hoveredShape === shape) {
            ctx.strokeStyle = "rgba(0, 0, 0, 1)"; // Change color for hover
            ctx.lineWidth += 1; // Highlight with thicker stroke
          }
          drawArrow(shape.startX, shape.startY, shape.endX , shape.endY, shape.type === "arrowDouble");
          break;
  
        case "gdandt":
          if (hoveredShape === shape) {
            drawGDAndTShape(shape); // Highlight the GD&T shape
          }
          drawGDAndTShape(shape); // Assuming this is handled with the proper scale adjustments
          break;
        case "datum":
          drawDatum(shape);  
          break;  
        case "circleDatum":
          if(hoveredShape === shape){
            drawCircleDatum(shape);  
          }
          drawCircleDatum(shape);
          break;  
        case "bubble":
          if(hoveredShape === shape){
            drawBubble(shape);  
          }
          drawBubble(shape);
          break;
        case "sr":
          if(hoveredShape === shape){
            drawSurfaceRoughness(shape); 
            drawSurfaceRoughness(shape);
            drawSurfaceRoughness(shape); 
          }
          drawSurfaceRoughness(shape); 
          break;      
        case "text":
          const scaledFontSize = 16 * scale; // Scale font size
          ctx.font = `${scaledFontSize}px Arial`;
          ctx.fillStyle = shape.style?.color || "black"; // Use default color if no color is specified

          // Calculate scaled positions without reapplying pan
          const scaledX = shape.startX * scale;
          const scaledY = shape.startY * scale;

          if(hoveredShape === shape) {
            ctx.font = "bold " + ctx.font; // Highlight the text
          }

          if (shape.rotation !== 0) {
            // Draw rotated text
            drawRotatedText(scaledX, scaledY, shape.text, shape.rotation);
          } else {
            // Draw regular text
            ctx.fillText(shape.text, scaledX, scaledY);
          }
          break;

      }
  
      if (hoveredShape === shape) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
        ctx.fill();
      }

  
    });
    ctx.restore();

    // Draw the crosshair on top
    if (crosshairPosition && (mode === "line" ||
      mode === "arrowOne" ||
      mode === "arrowDouble" ||
      mode === "circle" ||
      mode === "arc" ||
      mode === "rectangle")) {
      drawCrosshair(crosshairPosition.x, crosshairPosition.y);
    }
  }

  function drawCrosshair(x, y) {
    ctx.save();
    ctx.setLineDash([5, 5]); // Optional: dashed line style
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent black
    ctx.lineWidth = 1;

    // Draw horizontal line
    ctx.beginPath();
    ctx.moveTo(0, y * scale + panY * scale);
    ctx.lineTo(canvas.width, y * scale + panY * scale);
    ctx.stroke();

    // Draw vertical line
    ctx.beginPath();
    ctx.moveTo(x * scale + panX * scale, 0);
    ctx.lineTo(x * scale + panX * scale, canvas.height);
    ctx.stroke();

    ctx.restore();
}

function drawSurfaceRoughness(shape) {
  let x = shape.x;
  let y = shape.y;
  let a = shape.a;
  let b = shape.b;
  let c = shape.c;
  let d = shape.d;

  let variant = shape.variant;

  x = x * scale;
  y = y * scale;

  const height = 15 * scale;      // Total height of the symbol
  const width = 25 * scale;       // Total width between the outer points  

  ctx.strokeStyle = "black";
  ctx.fillStyle = "black";
  ctx.lineWidth = 1;
  ctx.font = `${10 * scale}px Arial`;  // Set font size and type

  // Base pattern for all variants - draw the angled line from bottom
  ctx.beginPath();
  ctx.moveTo(x, y + height / 2);                      // Start at bottom point
  ctx.lineTo(x + width / 2, y - height / 2 - (20 * scale));  // Right leg (flipped)
  ctx.moveTo(x, y + height / 2);                      // Back to bottom
  ctx.lineTo(x - width / 2, y - height / 2);           // Left leg (flipped)

  // Add horizontal line at the end of the right leg
  ctx.moveTo(x + width / 2, y - height / 2 - (20 * scale));   // Start at the end of right leg
  ctx.lineTo(x + width / 2 + (30 * scale), y - height / 2 - (20 * scale)); // Extend horizontally to the right

  ctx.stroke();

  // Add fixed values at points a, b, c, d
  ctx.fillText(a, x - (6 * scale), y - (10*scale));              // Position for "a"
  ctx.fillText(b, x + width / 2 + (5 * scale), y - height - (18 * scale));  // Position for "b"
  ctx.fillText(c, x + width / 2 + (5 * scale), y - height);    // Position for "c"
  ctx.fillText(d, x + width / 2, y + (5 * scale));   // Position for "d"

  if (variant === 'B') {
    // Add horizontal line at bottom
    ctx.beginPath();
    ctx.moveTo(x - width / 2, y - (8 * scale));
    ctx.lineTo(x + width / 2 - (7 * scale), y - (8 * scale));
    ctx.stroke();
  } else if (variant === 'C') {
    // Add circle at bottom
    const circleY = y + height - (19 * scale);
    ctx.beginPath();
    ctx.arc(x - (2 * scale), circleY, (5 * scale), 0, 2 * Math.PI);
    ctx.stroke();
  }
}


function drawDatum(shape) {
  let x = shape.x; // Click point X
  let y = shape.y; // Click point Y
  let s = shape.symbolD; // Symbol text
  let direction = shape.direction || 'up'; // Direction ('up', 'down', 'left', 'right')

  x = x * scale;
  y = y * scale; 

  // Adjusted sizes
  const rectangleWidth = 20 * scale; // Rectangle width
  const rectangleHeight = 20 * scale; // Rectangle height
  const triangleHeight = 12 * scale; // Triangle height
  const triangleWidth = 16 * scale; // Triangle width
  const lineGap = 25 * scale; // Gap between rectangle and triangle

  ctx.fillStyle = 'black';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 1;

  if (direction === 'up') {
    // Offset for 'up' direction
    const adjustedY = y - triangleHeight - lineGap - rectangleHeight;

    // Draw triangle
    ctx.beginPath();
    ctx.moveTo(x, y - triangleHeight); // Top of triangle
    ctx.lineTo(x - triangleWidth / 2, y); // Bottom-left
    ctx.lineTo(x + triangleWidth / 2, y); // Bottom-right
    ctx.closePath();
    ctx.fill();

    // Draw vertical line
    ctx.beginPath();
    ctx.moveTo(x, adjustedY + rectangleHeight);
    ctx.lineTo(x, y - triangleHeight);
    ctx.stroke();

    // Draw rectangle
    ctx.beginPath();
    ctx.rect(x - rectangleWidth / 2, adjustedY, rectangleWidth, rectangleHeight);
    ctx.stroke();

    // Draw text
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, adjustedY + rectangleHeight / 2);
  } else if (direction === 'down') {
    // Offset for 'down' direction
    const adjustedY = y + triangleHeight + lineGap;

    // Draw triangle
    ctx.beginPath();
    ctx.moveTo(x, y + triangleHeight); // Bottom of triangle
    ctx.lineTo(x - triangleWidth / 2, y); // Top-left
    ctx.lineTo(x + triangleWidth / 2, y); // Top-right
    ctx.closePath();
    ctx.fill();

    // Draw vertical line
    ctx.beginPath();
    ctx.moveTo(x, y + triangleHeight);
    ctx.lineTo(x, adjustedY);
    ctx.stroke();

    // Draw rectangle
    ctx.beginPath();
    ctx.rect(x - rectangleWidth / 2, adjustedY, rectangleWidth, rectangleHeight);
    ctx.stroke();

    // Draw text
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, adjustedY + rectangleHeight / 2);
  } else if (direction === 'left') {
    // Offset for 'left' direction
    const adjustedX = x - triangleWidth - lineGap - rectangleWidth;

    // Draw triangle
    ctx.beginPath();
    ctx.moveTo(x - triangleWidth, y); // Left of triangle
    ctx.lineTo(x, y - triangleHeight / 2); // Top-right
    ctx.lineTo(x, y + triangleHeight / 2); // Bottom-right
    ctx.closePath();
    ctx.fill();

    // Draw horizontal line
    ctx.beginPath();
    ctx.moveTo(x - triangleWidth, y);
    ctx.lineTo(adjustedX + rectangleWidth, y);
    ctx.stroke();

    // Draw rectangle
    ctx.beginPath();
    ctx.rect(adjustedX, y - rectangleHeight / 2, rectangleWidth, rectangleHeight);
    ctx.stroke();

    // Draw text
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, adjustedX + rectangleWidth / 2, y);
  } else if (direction === 'right') {
    // Offset for 'right' direction
    const adjustedX = x + triangleWidth + lineGap;

    // Draw triangle
    ctx.beginPath();
    ctx.moveTo(x + triangleWidth, y); // Right of triangle
    ctx.lineTo(x, y - triangleHeight / 2); // Top-left
    ctx.lineTo(x, y + triangleHeight / 2); // Bottom-left
    ctx.closePath();
    ctx.fill();

    // Draw horizontal line
    ctx.beginPath();
    ctx.moveTo(x + triangleWidth, y);
    ctx.lineTo(adjustedX, y);
    ctx.stroke();

    // Draw rectangle
    ctx.beginPath();
    ctx.rect(adjustedX, y - rectangleHeight / 2, rectangleWidth, rectangleHeight);
    ctx.stroke();

    // Draw text
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, adjustedX + rectangleWidth / 2, y);
  }
}

function drawCircleDatum(shape) {
  let x = shape.x * scale; // Scaled X position
  let y = shape.y * scale; // Scaled Y position
  const radius = 20 * scale; // Scaled radius

  let symbol = shape.symbol;
  let dimension = shape.dimension;

  ctx.save(); // Save the current context state

  // Draw the circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI); // Full circle
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 1; // Scale the line width
  ctx.stroke();

  // Draw the dividing line
  ctx.beginPath();
  ctx.moveTo(x - radius, y); // Left edge of the circle
  ctx.lineTo(x + radius, y); // Right edge of the circle
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 1; // Scale the line width
  ctx.stroke();

  // Add the top text (filler number)
  const topText = dimension; // Replace with the actual number
  ctx.font = `${14 * scale}px Arial`; // Scaled font size
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom'; // Position at the top half
  ctx.fillText(topText, x, y - 4);

  // Add the bottom text (filler letter)
  const bottomText = symbol; // Replace with the actual letter
  ctx.textBaseline = 'top'; // Position at the bottom half
  ctx.fillText(bottomText, x, y + 4);

  ctx.restore(); // Restore the context state
}

function drawBubble(shape) {
  // Extract properties
  let x = shape.x; // Center X
  let y = shape.y; // Center Y
  let number = shape.number || '1'; // Default number inside the circle

  // Adjust for scaling
  x = x * scale;
  y = y * scale;

  // Circle properties
  const radius = 10 * scale; // Circle radius (scaled)

  // Draw circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI); // Circle outline
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw number inside circle
  ctx.font = `${11 * scale}px Arial`; // Adjust font size based on scale
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'black';
  ctx.fillText(number, x, y); // Number at the circle center
}




//   function drawRotatedRect(x, y, width, height, angleInDegrees, isHovered = false,) {
//   // Convert the angle to radians
//   const angleInRadians = angleInDegrees * Math.PI / 180;

//   // Save the current state of the canvas
//   ctx.save();

//   // Move the origin to the center of the rectangle
//   ctx.translate(x + width / 2, y + height / 2);

//   // Rotate the canvas
//   ctx.rotate(angleInRadians);

//   // Optional: Apply highlight fill if hovered
//   if (isHovered) {
//     ctx.fillStyle = "rgba(0, 0, 0, 0.1)"; // Semi-transparent highlight
//     ctx.fillRect(-width / 2, -height / 2, width, height);
//   }

//   // Draw the rectangle outline
//   ctx.strokeStyle = "black"; // Optional: Set the stroke color
//   ctx.strokeRect(-width / 2, -height / 2, width, height);

//   // Restore the canvas state
//   ctx.restore();
// }


function isPointOnRotatedRectangleEdge(x, y, shape, tolerance) {
  if(shape.type === "gdandt") {
      const centerX = shape.x + 60;  // Shift to center horizontally
      const centerY = shape.y + 20;  // Shift to center vertically

      return (
        x >= centerX - 120 / 2 && 
        x <= centerX + 120 / 2 &&  // Right edge
        y >= centerY - 40 / 2 && 
        y <= centerY + 40 / 2     // Top edge
      );
  }

  const angleInRadians = shape.rotation * Math.PI / 180;

  // Step 1: Translate the click point to the rectangle's center
  const rectCenterX = shape.startX + shape.width / 2;
  const rectCenterY = shape.startY + shape.height / 2;
  const translatedX = x - rectCenterX;
  const translatedY = y - rectCenterY;

  // Step 2: Rotate the point back (reverse rotation)
  const unrotatedX = translatedX * Math.cos(-angleInRadians) - translatedY * Math.sin(-angleInRadians);
  const unrotatedY = translatedX * Math.sin(-angleInRadians) + translatedY * Math.cos(-angleInRadians);

  // Step 3: Check if the unrotated point is near the edges of the rectangle
  const leftEdge = Math.abs(unrotatedX + shape.width / 2) <= tolerance;
  const rightEdge = Math.abs(unrotatedX - shape.width / 2) <= tolerance;
  const topEdge = Math.abs(unrotatedY + shape.height / 2) <= tolerance;
  const bottomEdge = Math.abs(unrotatedY - shape.height / 2) <= tolerance;

  return (
      (leftEdge || rightEdge) && unrotatedY >= -shape.height / 2 && unrotatedY <= shape.height / 2 ||
      (topEdge || bottomEdge) && unrotatedX >= -shape.width / 2 && unrotatedX <= shape.width / 2
  );
}


// Helper function
function drawRectangle(ctx, x, y, width, height, text = "", textAlign = "center", font = "10px Arial") {
  ctx.strokeStyle = "black";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  if (text) {
      ctx.font = font;
      ctx.fillStyle = "black";
      ctx.textAlign = textAlign;
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + width / 2, y + height / 2);
  }
}

// Helper function
function drawDatumRectangles(ctx, x, y, width, height, datums) {
  if (datums.length === 1) {
      drawRectangle(ctx, x, y, width, height, datums[0]);
  } else {
      const segmentWidth = width / datums.length;
      datums.forEach((datum, index) => {
          ctx.beginPath();
          ctx.moveTo(x + segmentWidth * index, y);
          ctx.lineTo(x + segmentWidth * index, y + height);
          ctx.stroke();

          drawRectangle(
              ctx,
              x + segmentWidth * index,
              y,
              segmentWidth,
              height,
              datum,
              "center"
          );
      });
  }
}

function drawGDAndTShape(shape) {
  let { x, y, symbol, diameter, toleranceValue, modifier, datums } = shape;
  const rectWidth = 50 * scale;
  const rectHeight = 16 * scale;

  x = x * scale;
  y = y * scale;
  

  // Draw first two rectangles
  drawRectangle(ctx, x, y, rectWidth, rectHeight, symbol);
  const toleranceText = `${diameter} ${toleranceValue} ${modifier}`.trim();
  drawRectangle(ctx, x + rectWidth, y, rectWidth, rectHeight, toleranceText);

  // Draw datum rectangles
  if (datums.length > 0) {
      drawDatumRectangles(ctx, x + rectWidth * 2, y, rectWidth, rectHeight, datums);
  }
}

function drawOnCanvas(x, y) {
  setMode("gdandt");
  const symbol = document.getElementById("symbolInput").value;
  const diameter = document.getElementById("toleranceDiameter").value;
  const toleranceValue = document.getElementById("toleranceValue").value;
  const modifier = document.getElementById("toleranceModifier").value;
  const datum1 = document.getElementById("datumInput1").value;
  const datum2 = document.getElementById("datumInput2").value;
  const datum3 = document.getElementById("datumInput3").value;
  const rectWidth = 60;
  const rectHeight = 20;
  const totalWidth = rectWidth * (datum1.length + datum2.length + datum3.length); // 2 for symbol & tolerance + datums
  const totalHeight = rectHeight;


  // Save shape details into the shapes array
  const newShape = {
      type: "gdandt",
      x,
      y,
      symbol,
      diameter,
      toleranceValue,
      modifier,
      datums: [datum1, datum2, datum3].filter((val) => val !== ""),
      width: totalWidth,
      height: totalHeight,
      rotation: 0,
  };

  shapes.push(newShape); // Add to shapes array
  redrawCanvas(); // Redraw the canvas
}

function datumOnCanvas(x, y) {
  setMode("datum");
  const symbolD = document.getElementById("symbolInputD").value;
  const direction = document.getElementById("directionInput").value;

  const newShape = {
    type: "datum",
    x,
    y,
    symbolD,
    direction,
  };
  shapes.push(newShape);
  redrawCanvas();
}

function circleDatumOnCanvas(x, y) {
  setMode("circleDatum");
  const dimension = document.getElementById("circleDimension").value;
  const symbol = document.getElementById("circleSymbol").value;

  const newShape = {
    type: "circleDatum",
    x,
    y,
    dimension,
    symbol,
  };
  shapes.push(newShape);
  redrawCanvas();
}

function bubbleOnCanvas(x, y) {
  setMode("bubble");
  const number = document.getElementById("numberInput").value;

  const newShape = {
    type: "bubble",
    x,
    y,
    number,
  };
  shapes.push(newShape);
  redrawCanvas();
}

function srOnCanvas(x, y) {
  setMode("sr");  
  const variant = document.getElementById("variantInput").value;
  const a = document.getElementById("aInput").value;
  const b = document.getElementById("bInput").value;
  const c = document.getElementById("cInput").value;
  const d = document.getElementById("dInput").value;

  const newShape = {
    type: "sr",
    x,
    y,
    variant,
    a,
    b,
    c,
    d,
  };
  shapes.push(newShape);
  redrawCanvas();
}


function downloadCanvas() {
  const canvas = document.getElementById('cadCanvas');
  const link = document.createElement('a');
  link.download = 'output.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}


canvas.addEventListener("click", (e) => {
  selectedRotateShape = null; // Reset selected shape
  const { offsetX, offsetY } = e; // Get mouse position relative to the canvas

  if (mode === "text") {
    addTextInput(offsetX, offsetY);
    return; // Exit after handling text mode
  }

  if (mode === "rotate") {
    selectedRotateShape = null;
  
    // Check if the click is inside any shape
    shapes.forEach((shape) => {
      if (shape.type === "rectangle" || shape.type === "gdandt" || shape.type === "text") {
        if (isPointOnShape(offsetX, offsetY, shape)) {
          selectedRotateShape = shape;
        }
      }
    });
  
    if (selectedRotateShape) {
      const newRotationAngle = prompt("Enter rotation angle (in degrees):");
      if (newRotationAngle !== null) {
        selectedRotateShape.rotation += parseFloat(newRotationAngle); // Update the shape's rotation property
        redrawCanvas();
      }
    }
  }

  redrawCanvas(); // Redraw the canvas after rotation
});

function drawCenterCross(centerX, centerY, radius) {
  ctx.setLineDash([]); // Reset dash before drawing solid lines
  ctx.strokeStyle = "gray";
  ctx.lineWidth = 1;

  // Dash pattern for extending lines (big dash, small dash)
  ctx.setLineDash([15, 5, 5, 5]);

  // Vertical line (excluding the small cross area)
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - radius);
  ctx.lineTo(centerX, centerY - 12); // Stop before the center cross
  ctx.moveTo(centerX, centerY + 12); // Start after the center cross
  ctx.lineTo(centerX, centerY + radius);
  ctx.stroke();

  // Horizontal line (excluding the small cross area)
  ctx.beginPath();
  ctx.moveTo(centerX - radius, centerY);
  ctx.lineTo(centerX - 12, centerY); // Stop before the center cross
  ctx.moveTo(centerX + 12, centerY); // Start after the center cross
  ctx.lineTo(centerX + radius, centerY);
  ctx.stroke();

  // Reset dash to solid lines
  ctx.setLineDash([]);

  // Draw small cross at the center
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(centerX - 5, centerY);
  ctx.lineTo(centerX + 5, centerY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX, centerY - 5);
  ctx.lineTo(centerX, centerY + 5);
  ctx.stroke();
}



function isPointOnShape(x, y, shape) {
  if (shape.type === "rectangle" || shape.type === "gdandt") {
    return isPointOnRotatedRectangleEdge(x, y, shape, 5);
  } else if (shape.type === "text") {
      const textWidth = ctx.measureText(shape.text).width;
      const textHeight = parseInt(ctx.font, 10); // Assuming font is set, e.g., '20px Arial'
      
      // Transform text coordinates with pan and scale
      const transformedX = shape.startX * scale + panX;
      const transformedY = shape.startY * scale + panY;

      return (
        x >= transformedX &&
        x <= transformedX + textWidth &&
        y >= transformedY - textHeight / 2 &&
        y <= transformedY + textHeight / 2
      );
  }
  return false;
}

// Modified draw function to handle rotating different shapes
function drawRotatedShape(shape) {
  if (shape.type === "rectangle" || shape.type === "gdandt") {
    drawRotatedRect(shape.startX, shape.startY, shape.width, shape.height, shape.rotation);
  } else if (shape.type === "text") {
    drawRotatedText(shape.startX, shape.startY, shape.text, shape.rotation);
  }
}

function drawRotatedRect(x, y, width, height, angleInDegrees) {
  const angleInRadians = angleInDegrees * Math.PI / 180;
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(angleInRadians);
  ctx.strokeStyle = "black";
  ctx.strokeRect(-width / 2, -height / 2, width, height);
  ctx.restore();
}

// New function to draw rotated text
function drawRotatedText(x, y, text, angleInDegrees) {
  const angleInRadians = angleInDegrees * Math.PI / 180;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleInRadians);
  ctx.font = "16px Arial";  // Adjust the font size as needed
  ctx.fillStyle = "black";  // Text color
  ctx.fillText(text, -ctx.measureText(text).width / 2, 0); // Center the text
  ctx.restore();
}
  

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / scale - panX; // Subtract panX
  const y = (e.clientY - rect.top) / scale - panY; // Subtract panY

  if(mode === "pan") {
    isPanning = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  if (mode === "move" && selectedShape && selectedShape.type != "gdandt" && selectedShape.type != "datum" && selectedShape.type != "circleDatum" && selectedShape.type != "bubble" && selectedShape.type != "sr" ) {
    isMoving = true;
    moveOffsetX = x - selectedShape.startX;
    moveOffsetY = y - selectedShape.startY;
    return;
  }

  else if(mode === "move" && selectedShape && (selectedShape.type === "gdandt" || selectedShape.type === "datum" || selectedShape.type === "circleDatum" || selectedShape.type === "bubble" || selectedShape.type === "sr")) {
    isMoving = true;
    moveOffsetX = x - selectedShape.x;
    moveOffsetY = y - selectedShape.y;
    return;
  }

  if (mode === "text") {
    addTextInput(x, y);
    return;
  }

  if (mode === "gdandt") {
    drawOnCanvas(x, y);
  }

  if (mode === "datum") {
    datumOnCanvas(x, y);
  }

  if (mode === "circleDatum") {
    circleDatumOnCanvas(x,y);
  }

  if (mode === "bubble") {
    bubbleOnCanvas(x,y);
  }

  if (mode === "sr") {
    srOnCanvas(x,y);
  }

  if (mode === "draw") {
    // Initialize a new freehand shape
    currentFreehandShape = {
      type: "freedraw",
      points: [{ x, y }], // Start with the initial point
      style: currentLineStyle,
    };
    shapes.push(currentFreehandShape); // Add the shape to the shapes array
    isDrawing = true;
  }
  

  startX = x;
  startY = y;
  isDrawing = true;
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / scale - panX; // Subtract panX
  const y = (e.clientY - rect.top) / scale - panY; // Subtract panY

  crosshairPosition = { x, y }; // Always update crosshair position

  if (mode === "draw") {
    // Add the new point to the current freehand shape
    currentFreehandShape.points.push({ x, y });

    // Draw the new segment
    ctx.beginPath();
    const lastPoint = currentFreehandShape.points[currentFreehandShape.points.length - 2];
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  if (mode === "erase") {
    if (isDrawing) {
      const erasedShape = shapes.find((shape) => isShapeHovered(shape, x, y));
      if (erasedShape) {
        actionStack.push({ type: "erase", shape: erasedShape });
        shapes = shapes.filter((shape) => shape !== erasedShape);
        redrawCanvas();
      }
    }
    return;
  }


  if (isMoving && selectedShape) {
    const dx = x - moveOffsetX;
    const dy = y - moveOffsetY;

    if (
      selectedShape.type === "line" ||
      selectedShape.type === "arrowOne" ||
      selectedShape.type === "arrowDouble"
    ) {
      const offsetX = dx - selectedShape.startX;
      const offsetY = dy - selectedShape.startY;
      selectedShape.startX += offsetX;
      selectedShape.startY += offsetY;
      selectedShape.endX += offsetX;
      selectedShape.endY += offsetY;
    } else if (selectedShape.type === "gdandt") {
      const offsetX = dx - selectedShape.x;
      const offsetY = dy - selectedShape.y;
      selectedShape.x += offsetX;
      selectedShape.y += offsetY;
    } else if (selectedShape.type === "datum" || selectedShape.type === "circleDatum" || selectedShape.type === "bubble" || selectedShape.type === "sr") {
      const offsetX = dx - selectedShape.x; 
      const offsetY = dy - selectedShape.y;
    
      // Update the position
      selectedShape.x += offsetX;
      selectedShape.y += offsetY;
    }
    else {
      selectedShape.startX = dx;
      selectedShape.startY = dy;
    }
    redrawCanvas();
    return;
  }

  if (!isDrawing) {
    let hoveredShape = shapes.find((shape) => isShapeHovered(shape, x, y));
    selectedShape = hoveredShape;
    redrawCanvas(hoveredShape);
    return;
  }

  if (mode === "pan" && isPanning) {
    const deltaX = e.clientX - lastMouseX;
    const deltaY = e.clientY - lastMouseY;

    panX += deltaX / scale; // Adjust by scale to keep panning consistent
    panY += deltaY / scale;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    redrawCanvas();
  }

  crosshairPosition = {
    x: (e.clientX - rect.left) / scale - panX,
    y: (e.clientY - rect.top) / scale - panY
  };

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  redrawCanvas();

  applyLineStyle(currentLineStyle);

  if (mode === "line") {
    ctx.beginPath();
    ctx.moveTo((startX + panX) * scale, (startY + panY) * scale); // Adjust for pan and scale
    ctx.lineTo((x + panX) * scale, (y + panY) * scale); // Adjust for pan and scale
    ctx.stroke();
  } else if (mode === "rectangle") {
    const width = x - startX;
    const height = y - startY;
    ctx.strokeRect(
      (startX + panX) * scale,
      (startY + panY) * scale,
      width * scale,
      height * scale
    ); // Adjust for pan and scale
  } else if (mode === "circle") {
    const radius = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);
    ctx.beginPath();
    ctx.arc(
      (startX + panX) * scale,
      (startY + panY) * scale,
      radius * scale,
      0,
      2 * Math.PI
    ); // Adjust for pan and scale
    ctx.stroke();
  } else if (mode === "arc") {
    const radius = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);
  
    const startAngleInput = document.getElementById("startAngle").value;
    const endAngleInput = document.getElementById("endAngle").value;
  
    const startAngle = (startAngleInput * Math.PI) / 180;
    const endAngle = (endAngleInput * Math.PI) / 180;
  
    ctx.beginPath();
    ctx.arc(
      (startX + panX) * scale,
      (startY + panY) * scale,
      radius * scale,
      startAngle,
      endAngle
    ); // Adjust for pan and scale
    ctx.stroke();
  } else if (mode === "arrowOne") {
    drawArrow(startX + panX, startY + panY, x + panX, y + panY, false); // Adjust for pan
  } else if (mode === "arrowDouble") {
    drawArrow(startX + panX, startY + panY, x + panX, y + panY, true); // Adjust for pan
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (mode === "draw") {
    isDrawing = false;
    currentFreehandShape = null; // Reset the freehand shape
  }
  
  if (isMoving) {
    isMoving = false;
    return;
  }

  if (!isDrawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / scale - panX; // Subtract panX
  const y = (e.clientY - rect.top) / scale - panY; // Subtract panY

   if (mode === "line") {
    shapes.push({
      type: "line",
      startX,
      startY,
      endX: x,
      endY: y,
      style: currentLineStyle,
    });
  } else if (mode === "rectangle") {
    const width = x - startX;
    const height = y - startY;
    shapes.push({
      type: "rectangle",
      startX,
      startY,
      width,
      height,
      rotation: 0,
      style: currentLineStyle,
    });
  } else if (mode === "circle") {
    const radius = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);
    shapes.push({
      type: "circle",
      startX,
      startY,
      radius,
      style: currentLineStyle,
    });
  } else if (mode === "arc") {
    const radius = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);

    // Read angles from input fields
    const startAngleInput = document.getElementById("startAngle").value;
    const endAngleInput = document.getElementById("endAngle").value;

    // Convert degrees to radians
    const startAngle = (startAngleInput * Math.PI) / 180;
    const endAngle = (endAngleInput * Math.PI) / 180;

    shapes.push({
      type: "arc",
      startX,
      startY,
      radius,
      startAngle,
      endAngle,
      style: currentLineStyle,
    });
  } else if (mode === "arrowOne") {
    shapes.push({
      type: "arrowOne",
      startX,
      startY,
      endX: x,
      endY: y,
      style: currentLineStyle,
    });
  } else if (mode === "arrowDouble") {
    shapes.push({
      type: "arrowDouble",
      startX,
      startY,
      endX: x,
      endY: y,
      style: currentLineStyle,
    });
  }

  isDrawing = false;
  isPanning = false;
  isFreehandDrawing = false;
  redrawCanvas();
});

canvas.addEventListener("mouseleave", () => {
  isPanning = false;

  crosshairPosition = null; // Hide the crosshair when the cursor leaves the canvas
  redrawCanvas();
});

// Mouse wheel zoom
canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  const zoomAmount = 0.1;

  // Determine zoom direction
  if (event.deltaY < 0) {
    scale = Math.min(scale + zoomAmount, maxScale); // Zoom in
  } else {
    scale = Math.max(scale - zoomAmount, minScale); // Zoom out
  }

  redrawCanvas();
});