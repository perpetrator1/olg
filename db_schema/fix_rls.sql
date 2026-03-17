-- Update Materials SELECT policy to allow teachers and verifiers to see pending materials
DROP POLICY IF EXISTS "Materials are viewable by everyone" ON materials;
CREATE POLICY "Materials are viewable by everyone" ON materials 
FOR SELECT USING (
  status = 'approved' 
  OR auth.uid() = uploaded_by 
  OR EXISTS (
    SELECT 1 FROM profiles 
    JOIN roles ON profiles.role_id = roles.id 
    WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'teacher', 'verifier')
  )
);

-- Allow teachers and verifiers to update materials (for approval/rejection)
DROP POLICY IF EXISTS "Management can update materials" ON materials;
CREATE POLICY "Management can update materials" ON materials
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    JOIN roles ON profiles.role_id = roles.id 
    WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'teacher', 'verifier')
  )
);

-- Ensure requests are viewable by teachers and admins
DROP POLICY IF EXISTS "Requests are viewable by management" ON requests;
CREATE POLICY "Requests are viewable by management" ON requests
FOR SELECT USING (
  auth.uid() = requested_by
  OR EXISTS (
    SELECT 1 FROM profiles 
    JOIN roles ON profiles.role_id = roles.id 
    WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'teacher')
  )
);

-- Allow verifiers to see upgrade requests (if they are involved, but usually they just verify notes)
-- For now, let's stick to notes verification for verifiers.

-- Add a policy for reports (if we use requests table for reports)
-- Existing requests policy only allowed admins to update. Let's allow teachers too.
DROP POLICY IF EXISTS "Management can update requests" ON requests;
CREATE POLICY "Management can update requests" ON requests
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    JOIN roles ON profiles.role_id = roles.id 
    WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'teacher')
  )
);

-- Allow students and verifiers to create report requests
DROP POLICY IF EXISTS "Anyone can create requests" ON requests;
CREATE POLICY "Anyone can create requests" ON requests
FOR INSERT WITH CHECK (
  auth.uid() = requested_by
);
