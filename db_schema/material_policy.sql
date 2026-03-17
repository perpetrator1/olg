-- 1. Allow Teachers and Verifiers to see pending materials
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

-- 2. Allow management to update/verify materials
DROP POLICY IF EXISTS "Management can update materials" ON materials;
CREATE POLICY "Management can update materials" ON materials
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    JOIN roles ON profiles.role_id = roles.id 
    WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'teacher', 'verifier')
  )
);

-- 3. Allow Students/Verifiers to submit reports (requests)
DROP POLICY IF EXISTS "Anyone can create requests" ON requests;
CREATE POLICY "Anyone can create requests" ON requests
FOR INSERT WITH CHECK ( auth.uid() = requested_by );

-- 4. Allow management to see and process reports
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
