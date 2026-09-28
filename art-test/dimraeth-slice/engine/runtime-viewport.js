/** Test the pre-transform sprite rectangle against the actual, zoomed Canvas.
 * At zoom < 1 the visible pre-transform region extends outside [0,W]×[0,H].
 */
export function zoomViewportIntersects(x0,y0,x1,y1,pad=0,zoom=1,width=1280,height=720){
 const z=Math.max(.01,zoom);
 const left=width/2-width/(2*z)-pad,right=width/2+width/(2*z)+pad;
 const top=height/2-height/(2*z)-pad,bottom=height/2+height/(2*z)+pad;
 return Math.max(x0,x1)>=left&&Math.min(x0,x1)<=right&&Math.max(y0,y1)>=top&&Math.min(y0,y1)<=bottom;
}
