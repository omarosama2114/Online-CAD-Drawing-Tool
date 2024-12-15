const canvas = document.getElementById("cadCanvas");
const ctx = canvas.getContext("2d");

let mode = "";
let isDrawing = false;
let isMoving = false;
let isRotating = false;
let startX, startY;
let moveOffsetX = 0, moveOffsetY = 0;
let shapes = [];
let actionStack = [];
let redoStack = [];
let currentLineStyle = "default";
let selectedShape = null;
let selectedRotateShape = null;
let backgroundImg = null; // Variable to store the background image

let file;


let isFreeDrawing = false;

function setMode(selectedMode) {
  mode = selectedMode;
  // Show arc inputs only when 'arc' mode is selected
  const arcInputs = document.getElementById("arcInputs");
  if (selectedMode === "arc") {
    arcInputs.style.display = "flex";
  } else if(selectedMode === "rotate") {
    arcInputs.style.display = "none";
    isRotating = true;
  } else {
      arcInputs.style.display = "none";
  }

  updateCursor();
}

// Function to update the cursor based on the mode
function updateCursor() {
	if (mode === "text") {
	  canvas.style.cursor = "text"; // Typing cursor for text mode
	} else if (mode === "move") {
	  canvas.style.cursor = "move"; // Move cursor for move mode
	} else if (mode === "erase") {
	  canvas.style.cursor = "crosshair"; // Crosshair cursor for erase mode
	} else if(mode === "rotate") {
    canvas.style.cursor = `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 214.367 214.367"><path d="M202.403,95.22c0,46.312-33.237,85.002-77.109,93.484v25.663l-69.76-40l69.76-40v23.494 c27.176-7.87,47.109-32.964,47.109-62.642c0-35.962-29.258-65.22-65.22-65.22s-65.22,29.258-65.22,65.22 c0,9.686,2.068,19.001,6.148,27.688l-27.154,12.754c-5.968-12.707-8.994-26.313-8.994-40.441C11.964,42.716,54.68,0,107.184,0 S202.403,42.716,202.403,95.22z"/></svg>'), auto`;

  }
  else {
	  canvas.style.cursor = "default"; // Default cursor for other modes
	}
}

function setLineStyle(style) {
  currentLineStyle = style;
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

canvas.addEventListener("click", (e) => {
  selectedRotateShape = null; // Reset selected shape
  const { offsetX, offsetY } = e; // Get mouse position relative to the canvas

  if (mode === "text") {
    const userInput = prompt("Enter Text:");
    if (userInput) {
      // Add the text to the shapes array
      shapes.push({
        type: "text",
        x: offsetX,
        y: offsetY,
        text: userInput,
        style: currentLineStyle,
      });
      redrawCanvas();
    }
    return; // Exit after handling text mode
  }

  if (mode === "rotate") {
    selectedRotateShape = null;
  
    // Check if the click is inside any shape
    shapes.forEach((shape) => {
      if (isPointOnRotatedRectangleEdge(offsetX, offsetY, shape, 5)) {
        selectedRotateShape = shape;
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

  drawRotatedRect(selectedRotateShape.startX, selectedRotateShape.startY, selectedRotateShape.width, selectedRotateShape.height, 45);
  redrawCanvas();

  // Add more modes here as needed
});


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

function isPointOnLine(px, py, x1, y1, x2, y2, tolerance = 5) {
  const distance =
    Math.abs((y2 - y1) * px - (x2 - x1) * py + x2 * y1 - y2 * x1) /
    Math.sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2));
  return distance <= tolerance;
}
  

canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (mode === "move" && selectedShape && selectedShape.type != "gdandt") {
    isMoving = true;
    moveOffsetX = x - selectedShape.startX;
    moveOffsetY = y - selectedShape.startY;
    return;
  }

  else if(mode === "move" && selectedShape && selectedShape.type === "gdandt") {
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

  startX = x;
  startY = y;
  isDrawing = true;
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

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
    } else if (selectedShape.type === "gtandt") {
      const offsetX = dx - selectedShape.x;
      const offsetY = dy - selectedShape.y;
      selectedShape.x += offsetX;
      selectedShape.y += offsetY;
    } else {
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

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  redrawCanvas();

  applyLineStyle(currentLineStyle);

  if (mode === "line") {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(x, y);
    ctx.stroke();
  } else if (mode === "rectangle") {
    const width = x - startX;
    const height = y - startY;
    ctx.strokeRect(startX, startY, width, height);
  } else if (mode === "circle") {
    const radius = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);
    ctx.beginPath();
    ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
    ctx.stroke();
  } else if (mode === "arc") {
    const radius = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);

    // Read angles from input fields
    const startAngleInput = document.getElementById("startAngle").value;
    const endAngleInput = document.getElementById("endAngle").value;

    // Convert degrees to radians
    const startAngle = (startAngleInput * Math.PI) / 180;
    const endAngle = (endAngleInput * Math.PI) / 180;

    ctx.beginPath();
    ctx.arc(startX, startY, radius, startAngle, endAngle);
    ctx.stroke();
  } else if (mode === "gdandt") {
    drawGDAndTShape(selectedShape);
  } 
   else if (mode === "arrowOne") {
    drawArrow(startX, startY, x, y, false);
  } else if (mode === "arrowDouble") {
    drawArrow(startX, startY, x, y, true);
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (isMoving) {
    isMoving = false;
    return;
  }

  if (!isDrawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

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
  redrawCanvas();
});


function drawArrow(x1, y1, x2, y2, doubleArrow) {
  const arrowLength = 10;
  const angle = Math.atan2(y2 - y1, x2 - x1);

  // Main arrow line
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);

  // Calculate angle for the arrowheads
  const angle1 = angle - Math.PI / 6;
  const angle2 = angle + Math.PI / 6;

  // Draw the first arrowhead
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - arrowLength * Math.cos(angle1),
    y2 - arrowLength * Math.sin(angle1)
  );

 
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - arrowLength * Math.cos(angle2),
    y2 - arrowLength * Math.sin(angle2)
  );

  // Draw the second arrowhead if doubleArrow is true
  if (doubleArrow) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(
      x1 - arrowLength * -Math.cos(angle2),
      y1 - arrowLength * -Math.sin(angle2)
    );

    ctx.moveTo(x1, y1);
    ctx.lineTo(
      x1 - arrowLength * -Math.cos(angle1),
      y1 - arrowLength *- Math.sin(angle1)
    );
  }


  ctx.stroke();
}


function isShapeHovered(shape, x, y) {
  switch (shape.type) {
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
      return (
        x >= shape.x &&
        y >= shape.y 
      );
    case "text":
      // Check if the click is within the area defined by the text position
      const textWidth = ctx.measureText(shape.text).width;
      const textHeight = parseInt(ctx.font, 10); // Assumes font size is set, e.g., '20px Arial'
      
      return (
        x >= shape.x &&
        x <= shape.x + textWidth &&
        y >= shape.y - textHeight / 2 && // Adjust y to center the hit box vertically
        y <= shape.y + textHeight / 2
      );
    default:
      return false;
  }
}

function addTextInput(x, y) {
	const input = document.createElement("input");
	input.type = "text";
	input.style.position = "absolute";
	input.style.left = `${x + canvas.offsetLeft}px`;
	input.style.top = `${y + canvas.offsetTop}px`;
	input.style.fontSize = "16px";
	input.style.border = "1px solid #0000";
	input.style.padding = "2px";
  
	document.body.appendChild(input);
	input.focus();
  
	// Save text on blur or enter and remove input
	input.addEventListener("blur", () => {
	  drawTextOnCanvas(x, y, input.value);
	  document.body.removeChild(input);
	});
  
	input.addEventListener("keydown", (e) => {
	  if (e.key === "Enter") {
		drawTextOnCanvas(x, y, input.value);
		document.body.removeChild(input);
	  }
	});
  }
  
  function drawTextOnCanvas(x, y, text) {
	if (!text) return;
	ctx.font = "16px Arial";
	ctx.fillStyle = "#0000"; // Text color
	ctx.fillText(text, x, y);
  
	// Save the text object to shapes for later redrawing
	shapes.push({
	  type: "text",
	  startX: x,
	  startY: y,
	  text: text,
	  font: "16px Arial",
	  color: "#0000",
	});
  }

function redrawCanvas(hoveredShape = null) {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
  
	if (backgroundImg) {
	  ctx.drawImage(backgroundImg, 0, 0, canvas.width, canvas.height);
	}

  // if (isRotating) {
  //   const angle = 10; // Example rotation angle
  //   shapes.forEach((shape) => rotateSelectedShape(angle));
  // }
  
	shapes.forEach((shape) => {
	  applyLineStyle(shape.style);
	  ctx.beginPath();
  
	  switch (shape.type) {
		case "line":
		  ctx.moveTo(shape.startX, shape.startY);
		  ctx.lineTo(shape.endX, shape.endY);
      if (hoveredShape === shape) {
        ctx.strokeStyle = "rgba(0, 0, 0, 1)"; // Change color for hover
        ctx.lineWidth += 2; // Highlight with thicker stroke
      }
		  ctx.stroke();
		  break;
      case "rectangle": 
      if (shape.rotation !== 0) { 
          if(hoveredShape === shape) {
            drawRotatedRect(shape.startX, shape.startY, shape.width, shape.height, shape.rotation, true);
          } else {
            drawRotatedRect(shape.startX, shape.startY, shape.width, shape.height, shape.rotation, false);
          }

      } else {
        if (hoveredShape === shape) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.1)"; // Highlight the rectangle
          ctx.fillRect(shape.startX, shape.startY, shape.width, shape.height);
        }
        ctx.strokeRect(shape.startX, shape.startY, shape.width, shape.height);
      }
      break;    
		case "circle":
		  ctx.arc(shape.startX, shape.startY, shape.radius, 0, 2 * Math.PI);
		  ctx.stroke();
		  break;
		case "arc":
		  ctx.arc(shape.startX, shape.startY, shape.radius, shape.startAngle, shape.endAngle);
		  ctx.stroke();
		  break;
		case "arrowOne":
      if (hoveredShape === shape) {
        ctx.strokeStyle = "rgba(0, 0, 0, 1)"; // Change color for hover
        ctx.lineWidth += 1; // Highlight with thicker stroke
      }
		  drawArrow(shape.startX, shape.startY, shape.endX, shape.endY, false);
		  break;
		case "arrowDouble":
      if (hoveredShape === shape) {
        ctx.strokeStyle = "rgba(0, 0, 0, 1)"; // Change color for hover
        ctx.lineWidth += 1; // Highlight with thicker stroke
      }
		  drawArrow(shape.startX, shape.startY, shape.endX, shape.endY, true);
		  break;  
    case "gdandt":
      drawGDAndTShape(shape); // Call the GD&T-specific draw function
      break;  
    case "text":
      ctx.font = "16px Arial";
      ctx.fillStyle = "black"; // Set the font color
      ctx.fillText(shape.text, shape.x, shape.y);
      break;
	  }
  
	  if (hoveredShape === shape) {
		ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
		ctx.fill();
	  }
	});
  }

  function drawRotatedRect(x, y, width, height, angleInDegrees, isHovered = false) {
  // Convert the angle to radians
  const angleInRadians = angleInDegrees * Math.PI / 180;

  // Save the current state of the canvas
  ctx.save();

  // Move the origin to the center of the rectangle
  ctx.translate(x + width / 2, y + height / 2);

  // Rotate the canvas
  ctx.rotate(angleInRadians);

  // Optional: Apply highlight fill if hovered
  if (isHovered) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)"; // Semi-transparent highlight
    ctx.fillRect(-width / 2, -height / 2, width, height);
  }

  // Draw the rectangle outline
  ctx.strokeStyle = "black"; // Optional: Set the stroke color
  ctx.strokeRect(-width / 2, -height / 2, width, height);

  // Restore the canvas state
  ctx.restore();
}


  function isPointOnRotatedRectangleEdge(x, y, shape, tolerance) {
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


  function drawGDAndTShape(shape) {
    const { x, y, symbol, diameter, toleranceValue, modifier, datums } = shape;

    const rectWidth = 60;
    const rectHeight = 20;

    // Draw rectangles
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, rectWidth, rectHeight);
    ctx.strokeRect(x + rectWidth, y, rectWidth, rectHeight);

    // Add text inside the first rectangle
    ctx.font = "10px Arial";
    ctx.fillStyle = "black";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(symbol, x + rectWidth / 2, y + rectHeight / 2);

    // Add text inside the second rectangle
    const toleranceText = diameter + " " + toleranceValue + " " + modifier;
    ctx.fillText(toleranceText.trim(), x + rectWidth + rectWidth / 2, y + rectHeight / 2);

    // Draw Datum rectangle content
    if (datums.length > 0) {
        const datumX = x + rectWidth * 2;
        const datumY = y;

        ctx.strokeRect(datumX, datumY, rectWidth, rectHeight);

        if (datums.length === 1) {
            ctx.fillText(datums[0], datumX + rectWidth / 2, datumY + rectHeight / 2);
        } else if (datums.length === 2) {
            const halfWidth = rectWidth / 2;
            ctx.beginPath();
            ctx.moveTo(datumX + halfWidth, datumY);
            ctx.lineTo(datumX + halfWidth, datumY + rectHeight);
            ctx.stroke();

            ctx.fillText(datums[0], datumX + halfWidth / 2, datumY + rectHeight / 2);
            ctx.fillText(datums[1], datumX + halfWidth + halfWidth / 2, datumY + rectHeight / 2);
        } else {
            const segmentWidth = rectWidth / 3;
            datums.forEach((datum, index) => {
                ctx.beginPath();
                ctx.moveTo(datumX + segmentWidth * index, datumY);
                ctx.lineTo(datumX + segmentWidth * index, datumY + rectHeight);
                ctx.stroke();

                ctx.fillText(datum, datumX + segmentWidth * index + segmentWidth / 2, datumY + rectHeight / 2);
            });
        }
    }
}

function showTrimForm() {
  const trimForm = document.getElementById("trimForm");
  trimForm.style.display = "block";
}

function hideTrimForm() {
  const trimForm = document.getElementById("trimForm");
  trimForm.style.display = "none";
}

function trimCanvas() {
  const x = parseInt(document.getElementById("trimX").value);
  const y = parseInt(document.getElementById("trimY").value);
  const width = parseInt(document.getElementById("trimWidth").value);
  const height = parseInt(document.getElementById("trimHeight").value);

  if (x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= canvas.width && y + height <= canvas.height) {
    const trimmedCanvas = document.createElement("canvas");
    trimmedCanvas.width = width;
    trimmedCanvas.height = height;
    const trimmedCtx = trimmedCanvas.getContext("2d");

    trimmedCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(trimmedCanvas, 0, 0);
  } else {
    alert("Invalid trim values. Please check and try again.");
  }

  hideTrimForm();
}

function drawOnCanvas(x , y) {
  setMode("gdandt");
  const symbol = document.getElementById('symbolInput').value;
  const diameter = document.getElementById('toleranceDiameter').value;
  const toleranceValue = document.getElementById('toleranceValue').value;
  const modifier = document.getElementById('toleranceModifier').value;
  const datum1 = document.getElementById('datumInput1').value;
  const datum2 = document.getElementById('datumInput2').value;
  const datum3 = document.getElementById('datumInput3').value;

  // Save shape details into the shapes array
  const newShape = {
      type: 'gdandt',
      x,
      y,
      symbol,
      diameter,
      toleranceValue,
      modifier,
      datums: [datum1, datum2, datum3].filter(val => val !== '')
  };

  shapes.push(newShape); // Add to shapes array
  redrawCanvas(); // Redraw the canvas
}


function downloadCanvas() {
  const canvas = document.getElementById('cadCanvas');
  const link = document.createElement('a');
  link.download = 'output.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function rotateSelectedShape(angle) {
  if (!selectedRotateShape) {
    console.log("No shape selected for rotation.");
    return;
  }

  const radians = (Math.PI / 180) * angle; // Convert angle to radians
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  // Calculate the center of the selected shape
  let centerX, centerY;
  if (selectedRotateShape.type === "rectangle") {
    drawRotatedRect(selectedRotateShape.startX, selectedRotateShape.startY, selectedRotateShape.width, selectedRotateShape.height, 45);

  } else if (selectedRotateShape.type === "line" || selectedRotateShape.type === "arrowOne" || selectedRotateShape.type === "arrowDouble") {
    centerX = (selectedRotateShape.startX + selectedRotateShape.endX) / 2;
    centerY = (selectedRotateShape.startY + selectedRotateShape.endY) / 2;
  } else {
    console.log("Unsupported shape type for rotation.");
    return;
  }

  // Rotate a point around the center
  function rotatePoint(x, y) {
    const dx = x - centerX;
    const dy = y - centerY;

    const rotatedX = dx * cos - dy * sin + centerX;
    const rotatedY = dx * sin + dy * cos + centerY;

    return { x: rotatedX, y: rotatedY };
  }

  if (selectedRotateShape.type === "line" || selectedRotateShape.type === "arrowOne" || selectedRotateShape.type === "arrowDouble") {
    const newStart = rotatePoint(selectedRotateShape.startX, selectedRotateShape.startY);
    const newEnd = rotatePoint(selectedRotateShape.endX, selectedRotateShape.endY);
    selectedRotateShape.startX = newStart.x;
    selectedRotateShape.startY = newStart.y;
    selectedRotateShape.endX = newEnd.x;
    selectedRotateShape.endY = newEnd.y;
  }

  isRotating = false;

  console.log("Shape rotated.");
}

function lineToAngle(ctx, x1, y1, length, angle) {

  angle *= Math.PI / 180;

  var x2 = x1 + length * Math.cos(angle),
      y2 = y1 + length * Math.sin(angle);

  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);

  return {x: x2, y: y2};
}



document.getElementById("trimBtn").addEventListener("click", showTrimForm);
document.getElementById("cancelTrimBtn").addEventListener("click", hideTrimForm);
document.getElementById("applyTrimBtn").addEventListener("click", trimCanvas);
document.getElementById('applyGdandt').addEventListener('click', function() {
  document.getElementById('gdandtForm').style.display = 'block';
});

document.getElementById('cancelGdandt').addEventListener('click', function() {
  document.getElementById('gdandtForm').style.display = 'none';
});
