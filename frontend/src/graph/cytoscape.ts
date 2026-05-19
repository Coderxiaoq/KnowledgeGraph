import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import coseBilkent from 'cytoscape-cose-bilkent'

cytoscape.use(fcose)
cytoscape.use(coseBilkent)

export { cytoscape }
