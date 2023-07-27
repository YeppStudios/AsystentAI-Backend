const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');
const User = mongoose.model('User');
const Workspace = mongoose.model('Workspace');

function generateApiKey() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let apiKey = '';
    for (let i = 0; i < 32; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      apiKey += chars[randomIndex];
    }
    return apiKey;
  }


router.post('/workspaces/add', requireAuth, async (req, res) => {
  const companyId = "64b133659f6250b0fafa512a";
  if (req.user.accountType === "company") {
    try {
      const { admins, employees } = req.body;
      const apiKey = generateApiKey(); // generate an API key
      const workspace = new Workspace({ 
        admins: [companyId], // add the company ID as an admin
        company: companyId, // set the company ID
        employees,
        apiKey // set the generated API key
      });
      await workspace.save();
      res.status(201).json(workspace);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create workspace' });
    }
  }
});

router.get('/workspace-company/:workspaceId', requireAuth, async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    if (workspaceId !== "null") {
    const workspace = await Workspace.findById(workspaceId)
      .populate({
        path: 'company',
        select: 'email tokenBalance _id plan uploadedBytes workspace accountType',
        populate: {
          path: 'plan',
          model: 'Plan'
        }
      })
      .populate('admins') 
      .populate('employees.user');

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Check if the user is an admin
    const isAdmin = workspace.admins.some(admin => admin._id.toString() === req.user._id.toString());

    if (isAdmin) {
      return res.status(200).json({ company: workspace.company[0] });
    }

    // Check if the user is an employee
    const employee = workspace.employees.find(emp => emp.user._id.toString() === req.user._id.toString());

    if (!employee) {
      return res.status(403).json({ error: 'You are not authorized to access this workspace' });
    }

    return res.status(200).json({ company: workspace.company[0] });
  } else {
    return res.status(404).json({ error: 'Workspace not found' });
  }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error });
  }
});



router.get('/workspace/:id', requireAuth, async (req, res) => {
  try {
    if (req.params.id !== "null") {
      const workspace = await Workspace.findById(req.params.id).populate('admins', 'email').populate('employees.user', 'email').exec();

      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
  
      return res.json(workspace);
    } else {
      return res.status(404).json({ error: 'Workspace not found' });
    }

  } catch (error) {
    console.error(error);
    return res.status(500).send('Server Error');
  }
});

router.delete('/delete-employees-and-invitations/:workspaceId', requireAdmin, async (req, res) => {
  const workspaceId = req.params.workspaceId;
  
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(400).json({ message: 'Workspace not found.' });
    }

    workspace.employees = [];
    workspace.invitations = [];

    await workspace.save();

    return res.json({ message: 'Employees and invitations successfully deleted.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post('/send-invitation', requireAuth, async (req, res) => {
  const { email, role } = req.body;
  const invitedBy = req.user._id;
  const workspace = await Workspace.findOne({ company: req.user._id });

  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' });
  }

  const companyAdmins = workspace.admins.filter(id => id.toString() === req.user._id.toString());
  if (companyAdmins.length === 0) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if invitation for this email already exists
  // const existingInvitation = workspace.invitations.find(invitation => invitation.email === email);
  // if (existingInvitation) {
  //   return res.status(400).json({ error: 'Invitation already sent to this email' });
  // }

  workspace.invitations.push({ email, role, invitedBy });
  await workspace.save();

  const inviteUrl = `https://www.yepp.ai/marketing?registration=true&workspace=${workspace._id}&invitedEmail=${email}`;

  return res.status(201).json({ invitationLink: inviteUrl });
});


router.put('/workspaces/:id/add-admin', requireAuth, async (req, res) => {
    const workspaceId = req.params.id;
    const adminId= req.body.id;
  
    try {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
  
      const companyAdmins = workspace.admins.filter(id => id.toString() === req.user._id.toString());
      if (companyAdmins.length === 0) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
  
      if (workspace.admins.includes(adminId)) {
        return res.status(400).json({ error: 'Admin already exists' });
      }
  
      workspace.admins.push(adminId);
      await workspace.save();
      res.json(workspace);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to add admin' });
    }
  });

router.post('/workspaces/:id/add-employee', requireAuth, async (req, res) => {
    const workspaceId = req.params.id;
    const { userId, role } = req.body;
  
    try {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
  
      const companyAdmins = workspace.admins.filter(id => id.toString() === req.user._id.toString());
      if (companyAdmins.length === 0) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
  
      const existingEmployee = workspace.employees.find(employee => employee.user.toString() === userId.toString());
      if (existingEmployee) {
        return res.status(400).json({ error: 'Employee already added to workspace' });
      }
  
      workspace.employees.push({ user: userId, role });
      await workspace.save();
      res.json(workspace);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to add employee' });
    }
  });
  

// Remove an employee from a workspace
router.delete('/workspaces/:id/delete-employee/:userEmail', requireAuth, async (req, res) => {
  const workspaceId = req.params.id;
  const userEmail = req.params.userEmail;

  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const companyAdmins = workspace.admins.filter(id => id.toString() === req.user._id.toString());
    if (companyAdmins.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const employeeIndex = workspace.employees.findIndex(employee => employee.email === userEmail);
    if (employeeIndex === -1) {
      return res.status(404).json({ error: 'Employee not found in workspace' });
    }

    const employee = workspace.employees[employeeIndex];

    // Set the workspace field of the user to null
    await User.findOneAndUpdate({ email: employee.email }, { workspace: undefined });

    workspace.employees.splice(employeeIndex, 1);
    await workspace.save();
    return res.json(workspace);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to remove employee' });
  }
});


  // Remove an admin from a workspace
router.put('/workspaces/:id/remove-admin', requireAuth, async (req, res) => {
    const workspaceId = req.params.id;
    const { adminId } = req.body;
  
    try {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
  
      const companyAdmins = workspace.admins.filter(id => id.toString() === req.user._id.toString());
      if (companyAdmins.length === 0) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
  
      if (workspace.admins.length === 1) {
        return res.status(400).json({ error: 'Cannot remove the only admin' });
      }
  
      const index = workspace.admins.indexOf(adminId);
      if (index === -1) {
        return res.status(400).json({ error: 'Admin not found' });
      }
  
      workspace.admins.splice(index, 1);
      await workspace.save();
      res.json(workspace);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to remove admin' });
    }
  });

  router.get('/invitatations', requireAuth, async (req, res) => {
    try {
      const workspace = await Workspace.findOne({ company: req.user._id });
  
      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
  
      const invitations = workspace.invitations;
      return res.json({ invitations });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/workspace/:workspaceId/regenerateApiKey', requireAuth, async (req, res) => {
    const workspace = await Workspace.findById(req.params.workspaceId);
    if (!workspace) {
        return res.status(404).send({ error: 'Workspace not found' });
    }
    
    // Only admins should be allowed to regenerate the API key
    if (!workspace.admins.includes(req.user._id)) {
        return res.status(403).send({ error: 'Unauthorized' });
    }
    
    const apiKey = generateApiKey();
    workspace.apiKey = apiKey;
    await workspace.save();
    
    res.send({ apiKey });
});
  
module.exports = router;